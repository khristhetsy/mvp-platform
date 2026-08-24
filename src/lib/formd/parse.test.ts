import { describe, it, expect } from "vitest";
import { parseFormD, stripNamespaces, daysSinceFirstSale } from "./parse";

// A representative Form D primary_doc.xml (no namespace) exercising every field
// the parser reads, including a "None" placement-agent recipient and a signer that
// matches a related person.
const PLAIN = `
<edgarSubmission>
  <submissionType>D</submissionType>
  <primaryIssuer>
    <cik>0001234567</cik>
    <entityName>Acme Robotics, Inc.</entityName>
    <issuerAddress>
      <street1>100 Main St</street1>
      <city>Austin</city>
      <stateOrCountry>TX</stateOrCountry>
      <zipCode>78701</zipCode>
    </issuerAddress>
    <issuerPhoneNumber>512-555-0100</issuerPhoneNumber>
    <jurisdictionOfInc>DELAWARE</jurisdictionOfInc>
    <entityType>Corporation</entityType>
    <yearOfInc><value>2021</value></yearOfInc>
  </primaryIssuer>
  <relatedPersonsList>
    <relatedPersonInfo>
      <relatedPersonName><firstName>Jane</firstName><lastName>Doe</lastName></relatedPersonName>
      <relatedPersonAddress><city>Austin</city><stateOrCountry>TX</stateOrCountry><street1>1 Private Rd</street1></relatedPersonAddress>
      <relatedPersonRelationshipList><relationship>Executive Officer</relationship><relationship>Director</relationship></relatedPersonRelationshipList>
    </relatedPersonInfo>
    <relatedPersonInfo>
      <relatedPersonName><firstName>John</firstName><lastName>Smith</lastName></relatedPersonName>
      <relatedPersonAddress><city>Austin</city><stateOrCountry>TX</stateOrCountry></relatedPersonAddress>
      <relatedPersonRelationshipList><relationship>Director</relationship></relatedPersonRelationshipList>
    </relatedPersonInfo>
  </relatedPersonsList>
  <offeringData>
    <industryGroup><industryGroupType>Manufacturing</industryGroupType></industryGroup>
    <issuerSize><revenueRange>$1,000,000 - $5,000,000</revenueRange></issuerSize>
    <federalExemptionsExclusions><item>06c</item></federalExemptionsExclusions>
    <typeOfFiling><newOrAmendment><isAmendment>false</isAmendment></newOrAmendment></typeOfFiling>
    <dateOfFirstSale><value>2025-06-01</value></dateOfFirstSale>
    <offeringSalesAmounts>
      <totalOfferingAmount>10000000</totalOfferingAmount>
      <totalAmountSold>3000000</totalAmountSold>
      <totalRemaining>7000000</totalRemaining>
    </offeringSalesAmounts>
    <minimumInvestmentAccepted>100000</minimumInvestmentAccepted>
    <salesCompensationList><recipient><recipientName>None</recipientName></recipient></salesCompensationList>
    <investorsList><totalNumberAlreadyInvested>12</totalNumberAlreadyInvested></investorsList>
    <signatureBlock><signature><nameOfSigner>Jane Doe</nameOfSigner><signatureTitle>CEO</signatureTitle></signature></signatureBlock>
  </offeringData>
</edgarSubmission>`;

const CTX = { accessionNo: "0001234567-25-000001", dateFiled: "2025-08-20", filingUrl: "https://sec.gov/x", formType: "D" as const };

describe("stripNamespaces", () => {
  it("removes xmlns attributes and element prefixes", () => {
    const out = stripNamespaces('<ns:root xmlns:ns="http://x" xmlns="http://y"><ns:a>1</ns:a></ns:root>');
    expect(out).toBe("<root><a>1</a></root>");
  });
});

describe("parseFormD — the namespace defect (acceptance §13.1)", () => {
  const plain = parseFormD(PLAIN, CTX);
  // default namespace on the root (the case that silently breaks path expressions)
  const defaultNs = parseFormD(PLAIN.replace("<edgarSubmission>", '<edgarSubmission xmlns="http://www.sec.gov/edgar/formdschema">'), CTX);
  // prefixed namespace on every element
  const prefixed = parseFormD(
    PLAIN.replace(/<(\/?)([A-Za-z][\w]*)/g, "<$1d:$2").replace("<d:edgarSubmission", '<d:edgarSubmission xmlns:d="http://www.sec.gov/edgar/formdschema"'),
    CTX,
  );

  it("namespaced and non-namespaced fixtures parse to identical output", () => {
    expect(defaultNs).toEqual(plain);
    expect(prefixed).toEqual(plain);
  });

  it("reads the core fields", () => {
    expect(plain.companyName).toBe("Acme Robotics, Inc.");
    expect(plain.cik).toBe("1234567");
    expect(plain.phone).toBe("512-555-0100");
    expect(plain.entityType).toBe("Corporation");
    expect(plain.state).toBe("TX");
    expect(plain.totalOffering).toBe(10_000_000);
    expect(plain.totalRemaining).toBe(7_000_000);
    expect(plain.pctSold).toBe(30);
    expect(plain.is506c).toBe(true);
    expect(plain.investorCount).toBe(12);
  });

  it("captures related persons WITHOUT street address (§13.7)", () => {
    expect(plain.relatedPersons).toHaveLength(2);
    expect(plain.relatedPersons[0]).toMatchObject({ fullName: "Jane Doe", relationships: "Executive Officer; Director", city: "Austin", state: "TX", isSigner: true });
    expect(JSON.stringify(plain.relatedPersons)).not.toContain("Private Rd");
  });
});

describe("parseFormD — degradation rules (§4.5)", () => {
  it("'Indefinite' offering amounts store as null, not zero (§13.3)", () => {
    const xml = PLAIN.replace("<totalOfferingAmount>10000000</totalOfferingAmount>", "<totalOfferingAmount>Indefinite</totalOfferingAmount>")
      .replace("<totalRemaining>7000000</totalRemaining>", "<totalRemaining>Indefinite</totalRemaining>");
    const f = parseFormD(xml, CTX);
    expect(f.totalOffering).toBeNull();
    expect(f.totalRemaining).toBeNull();
    expect(f.totalOffering).not.toBe(0);
  });

  it("'None' placement-agent recipients are dropped, flag stays truthful", () => {
    expect(parseFormD(PLAIN, CTX).hasPlacementAgent).toBe(false);
    const withAgent = PLAIN.replace("<recipientName>None</recipientName>", "<recipientName>Big Placement LLC</recipientName>");
    const f = parseFormD(withAgent, CTX);
    expect(f.hasPlacementAgent).toBe(true);
    expect(f.placementAgents).toBe("Big Placement LLC");
  });

  it("revenueRange falls back to NAV-prefixed net asset value", () => {
    const xml = PLAIN.replace("<issuerSize><revenueRange>$1,000,000 - $5,000,000</revenueRange></issuerSize>", "<issuerSize><aggregateNetAssetValueRange>$25,000,000 - $50,000,000</aggregateNetAssetValueRange></issuerSize>");
    expect(parseFormD(xml, CTX).revenueRange).toBe("NAV: $25,000,000 - $50,000,000");
  });

  it("dateOfFirstSale yetToOccur sets the flag and leaves the date null", () => {
    const xml = PLAIN.replace("<dateOfFirstSale><value>2025-06-01</value></dateOfFirstSale>", "<dateOfFirstSale><yetToOccur>true</yetToOccur></dateOfFirstSale>");
    const f = parseFormD(xml, CTX);
    expect(f.saleYetToOccur).toBe(true);
    expect(f.dateFirstSale).toBeNull();
  });
});

describe("daysSinceFirstSale", () => {
  it("computes whole days from an as-of date", () => {
    expect(daysSinceFirstSale("2025-06-01", new Date("2025-08-30T00:00:00Z"))).toBe(90);
    expect(daysSinceFirstSale(null)).toBeNull();
  });
});
