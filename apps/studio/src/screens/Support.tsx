import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { BRAND } from "@madeforyou/ui";
import { supportUpi } from "../lib/config";
import { SUPPORT_AMOUNTS, upiUri } from "../lib/support";
import { Button } from "../ui/Button";
import { toast } from "../ui/Controls";
import { Shell } from "../ui/Shell";

export function Support() {
  const vpa = supportUpi();
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [qr, setQr] = useState("");
  const uri = vpa ? upiUri(vpa, amount) : "";

  useEffect(() => {
    document.title = `Support ${BRAND.name}`;
  }, []);
  useEffect(() => {
    if (!uri) return;
    let alive = true;
    void QRCode.toString(uri, { type: "svg", errorCorrectionLevel: "M", margin: 4, color: { dark: "#000000", light: "#FFFFFF" } }).then((svg) => {
      if (alive) setQr(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    });
    return () => { alive = false; };
  }, [uri]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(vpa);
      toast("UPI ID copied");
    } catch {
      toast("Could not copy. You can select it and copy by hand.");
    }
  };

  if (!vpa) {
    return (
      <Shell>
        <div className="wrap empty">
          <h1>Support {BRAND.name}</h1>
          <p>This is not switched on yet. Thank you for thinking of it.</p>
          <Button href="#/" iconRight="right">Back to home</Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="wrap support">
        <h1>If {BRAND.name} helped you, you can say thanks</h1>
        <p className="support-lead">
          {BRAND.name} is free. It has no ads and nothing is hidden behind a payment. It is built and looked after by one person in Mumbai, and the small costs of keeping it running (storage, the emails it sends, and one day a proper web address) come out of his pocket.
        </p>
        <p className="support-lead">
          If it helped you tell someone you love how you feel, you are welcome to chip in any amount you like. Even a small amount means a lot. And if you would rather not, that is completely fine. Telling a friend about it helps just as much.
        </p>

        <section className="pcard support-card">
          <div className="support-amounts" role="group" aria-label="Choose an amount">
            {SUPPORT_AMOUNTS.map((a) => (
              <button key={a} type="button" className={amount === a ? "on" : ""} aria-pressed={amount === a} onClick={() => setAmount(a)}>₹{a}</button>
            ))}
            <button type="button" className={amount === undefined ? "on" : ""} aria-pressed={amount === undefined} onClick={() => setAmount(undefined)}>Any amount</button>
          </div>

          <div className="support-pay">
            <div className="support-qr">
              {qr && <img src={qr} width={220} height={220} alt={`UPI QR code to support ${BRAND.name}${amount ? `, ₹${amount}` : ""}`} />}
              <small>Scan with any UPI app</small>
            </div>
            <div className="support-actions">
              <Button size="lg" icon="heart" href={uri}>Pay with a UPI app</Button>
              <p className="field-hint">On a phone, this opens GPay, PhonePe, Paytm, BHIM or whichever UPI app you use.</p>
              <div className="support-id">
                <span>UPI ID</span>
                <code>{vpa}</code>
                <Button size="sm" variant="secondary" icon="copy" onClick={copy}>Copy</Button>
              </div>
            </div>
          </div>
        </section>

        <p className="field-hint support-small">
          This is a voluntary gift, not a purchase. Nothing is unlocked and nothing changes if you do not give. UPI payments to a person carry no fee, so the whole amount reaches {BRAND.operator}. Questions? <a href={`mailto:${BRAND.contactEmail}`}>{BRAND.contactEmail}</a>.
        </p>
        <p><Button variant="ghost" href="#/" icon="left">Back to {BRAND.name}</Button></p>
      </div>
    </Shell>
  );
}
