import { verifyUnsubscribeToken } from "@/lib/marketing/send";
import { addUnsubscribe } from "@/lib/marketing/contacts";
import { getTranslations } from "next-intl/server";

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function UnsubscribePage({ searchParams }: Props) {
  const params = await searchParams;
  const t = await getTranslations("appPages");
  const token = params.token ?? "";

  const email = verifyUnsubscribeToken(token);

  if (!email) {
    return (
      <div style={page}>
        <div style={card}>
          <h1 style={heading}>{t("invalid_link")}</h1>
          <p style={body}>
            This unsubscribe link is invalid or has expired. If you want to
            unsubscribe, please reply to the email with &quot;unsubscribe&quot; in the
            subject line.
          </p>
        </div>
      </div>
    );
  }

  // Suppress this email
  await addUnsubscribe(email, "user_request");

  return (
    <div style={page}>
      <div style={card}>
        <div style={check}>✓</div>
        <h1 style={heading}>{t("you_ve_been_unsubscribed")}</h1>
        <p style={body}>
          <strong>{email}</strong> has been removed from our mailing list.
          You won&apos;t receive any further marketing emails from us.
        </p>
        <p style={{ ...body, marginTop: 8, fontSize: 13, color: "#888" }}>
          Note: you may still receive transactional emails related to your
          account (e.g. password resets, security alerts).
        </p>
      </div>
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f8f8f6",
  padding: 24,
};

const card: React.CSSProperties = {
  background: "#fff",
  border: "0.5px solid #e0e0d8",
  borderRadius: 12,
  padding: "40px 48px",
  maxWidth: 480,
  width: "100%",
  textAlign: "center",
};

const check: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: "50%",
  background: "#EAF3DE",
  color: "#3B6D11",
  fontSize: 22,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  margin: "0 auto 20px",
};

const heading: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 500,
  color: "#1a1a1a",
  marginBottom: 12,
};

const body: React.CSSProperties = {
  fontSize: 15,
  color: "#555",
  lineHeight: 1.6,
  margin: 0,
};
