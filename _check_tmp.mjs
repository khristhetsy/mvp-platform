import assert from "node:assert";
const p = await import("./src/lib/email/compose-prefill.ts");
const t = await import("./src/components/email/tablist.ts");

// subject no-stacking
assert.equal(p.replySubject("Quarterly update"), "Re: Quarterly update");
assert.equal(p.replySubject("Re: Quarterly update"), "Re: Quarterly update");
assert.equal(p.replySubject("RE:  hi"), "RE:  hi");
assert.equal(p.forwardSubject("Deck"), "Fwd: Deck");
assert.equal(p.forwardSubject("Fwd: Deck"), "Fwd: Deck");
assert.equal(p.prefixSubject("Re", null), "Re:");
assert.equal(p.replySubject("Fwd: Deck"), "Re: Fwd: Deck");

// dedupe
assert.deepEqual(p.dedupeEmails(["A@x.com","b@x.com","a@X.com","",null,"  c@x.com "]), ["A@x.com","b@x.com","c@x.com"]);

// reply-all
let r = p.replyAllRecipients({ sender:"founder@startup.com", recipients:["me@capitalos.io","partner@vc.com","founder@startup.com"], self:"me@capitalos.io" });
assert.deepEqual(r.to, ["founder@startup.com"]);
assert.deepEqual(r.cc, ["partner@vc.com"]);
r = p.replyAllRecipients({ sender:"me@x.com", recipients:["a@x.com"], self:"me@x.com" });
assert.deepEqual(r.to, []);
assert.deepEqual(r.cc, ["a@x.com"]);

// buildPrefill table
assert.deepEqual(p.buildPrefill({mode:"new"}).to, []);
assert.deepEqual(p.buildPrefill({mode:"new", sender:"noreply@tips.preply.com"}).to, ["noreply@tips.preply.com"]);
let rp = p.buildPrefill({mode:"reply", sender:"x@y.com", subject:"Hello"});
assert.deepEqual(rp.to, ["x@y.com"]); assert.equal(rp.subject, "Re: Hello");
let ra = p.buildPrefill({mode:"replyAll", sender:"x@y.com", recipients:["me@c.io","z@y.com"], self:"me@c.io", subject:"Re: Hello"});
assert.deepEqual(ra.to, ["x@y.com"]); assert.deepEqual(ra.cc, ["z@y.com"]); assert.equal(ra.subject, "Re: Hello");
let fw = p.buildPrefill({mode:"forward", sender:"x@y.com", subject:"Deck", body:"hi"});
assert.deepEqual(fw.to, []); assert.equal(fw.subject, "Fwd: Deck");
assert.ok(fw.body.includes("Forwarded message") && fw.body.includes("hi"));

// tablist
assert.equal(t.nextTabIndex(0,"ArrowRight",3),1);
assert.equal(t.nextTabIndex(2,"ArrowRight",3),0);
assert.equal(t.nextTabIndex(0,"ArrowLeft",3),2);
assert.equal(t.nextTabIndex(2,"Home",3),0);
assert.equal(t.nextTabIndex(0,"End",3),2);
assert.equal(t.nextTabIndex(1,"Enter",3),1);
assert.equal(t.nextTabIndex(0,"ArrowRight",0),0);
assert.equal(t.isTabNavKey("ArrowRight"),true);
assert.equal(t.isTabNavKey("Enter"),false);

console.log("ALL PURE-LOGIC ASSERTIONS PASSED");
