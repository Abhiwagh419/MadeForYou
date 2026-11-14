import { BRAND } from "@madeforyou/ui";

/** The words of the Terms and the Privacy page. Written to be read by anyone, so they say what really happens. */
export interface Section { h: string; p?: string[]; ul?: string[] }
export interface Legal { title: string; updated: string; summary: string; sections: Section[] }

const who = `${BRAND.name}, run by ${BRAND.operator} in Mumbai, India`;
const mail = BRAND.contactEmail;
export const LEGAL_UPDATED = "14 November 2026";

export const TERMS: Legal = {
  title: "Terms of use",
  updated: LEGAL_UPDATED,
  summary: "MadeForYou is a free service for making personal pages for people you care about. You keep what you make. Be kind, do not post anything unlawful or hurtful, and only email people who would be glad to hear from you. We can remove a page that breaks these rules.",
  sections: [
    { h: "1. Who we are", p: [`${who}. In these terms, “we”, “us” and “MadeForYou” mean the person running it. You can reach us at ${mail}.`, "MadeForYou is free and is still being built. We provide it as it is, and we may change it, limit it or stop it."] },
    { h: "2. Using MadeForYou", ul: ["You should be 18 or older. If you are younger, use it with a parent or guardian.", "Keep your login safe. What happens under your account is your responsibility.", "Give true information. Do not pretend to be someone else."] },
    { h: "3. Your content", p: ["The photos, words, voice notes and everything else you put on a page are yours. You are responsible for them."], ul: [
      "You give us permission to store your content, show it to the people you share it with, and send the emails you ask us to send. We use it for nothing else.",
      "Only upload what you have the right to use. Do not use other people's photos, music or writing unless you are allowed to.",
      "If a page shows another person, make sure they are happy for it to be there. For a child, ask a parent or guardian first.",
    ] },
    { h: "4. What is not allowed", p: ["You may not use MadeForYou to:"], ul: [
      "break the law, or help someone else to",
      "threaten, harass, bully or shame anyone, or spread hatred",
      "post sexual content involving a child, or intimate pictures of anyone without their consent. We will report this to the authorities.",
      "share someone's private details, such as an address, phone number or documents, without their consent",
      "cheat or scare people, run scams, or send spam",
      "break someone's copyright or other rights",
      "attack or overload the website, or try to get into accounts or pages that are not yours",
    ] },
    { h: "5. Emails you send through MadeForYou", p: ["You can email a page to a person on a date you choose. Only email people who would be glad to hear from you. Every email includes a link to stop them, and we will never email an address that has stopped. We limit how many emails one page and one person can send."] },
    { h: "6. Reports and removing pages", p: ["Anyone can report a page using the “Report this page” link. We read every report. We may take down a page, or close an account, if it breaks these terms or the law, and we may do this without warning when something serious is involved.", `If you think we made a mistake, write to ${mail} and we will look again.`] },
    { h: "7. The free service", ul: ["There are limits, such as the number of pages and the photo space each person gets.", "Keep your own copies of photos and words you care about. We try to look after your pages, but we cannot promise they will always be available.", "We may add, change or remove features."] },
    { h: "8. Our responsibility", p: ["MadeForYou is provided without promises that it will always work or be free of errors. As far as the law allows, we are not responsible for losses that come from using a free service. Nothing here limits any right you have by law that cannot be limited."] },
    { h: "9. Ending your account", p: ["You can delete your account and everything in it at any time from the Account page. We may suspend or close an account that breaks these terms."] },
    { h: "10. Law", p: ["These terms follow the laws of India. Any dispute goes to the courts in Mumbai, Maharashtra."] },
    { h: "11. Changes and contact", p: [`If we change these terms we will update the date at the top of this page. If you keep using MadeForYou after a change, you accept the new terms. Questions or complaints: ${mail}.`] },
  ],
};

export const PRIVACY: Legal = {
  title: "Privacy",
  updated: LEGAL_UPDATED,
  summary: "We keep what you put on your pages, and the little we need to run your account. We do not sell data, show ads or track you across the web. You can delete a page or your whole account whenever you like.",
  sections: [
    { h: "1. Who is responsible", p: [`${who}. Questions, requests and complaints about privacy: ${mail}.`] },
    { h: "2. What we keep, and why", ul: [
      "Your account. You sign in through Clerk, our sign-in service. We keep an ID for you. Clerk keeps your email and login details. We ask Clerk for your email only to send you notices you would expect, such as “your page ends soon”.",
      "Your pages. The words, photos, voice notes, dates, music and video links, and settings you add, so that your page can open for the people you share it with. A page password is kept only in scrambled form.",
      "Messages from visitors. If you add a wishes wall, reply box or RSVP, visitors can send a name, a message, an answer, the number of guests and a note. If a guest asks for an event reminder, they can also add an email address. You, the page owner, can see these.",
      "Emails you send. The address you send to, their name, your name, your note and the send time, so that we can send it and honour a request to stop.",
      "Reports. If someone reports a page, we keep the reason, what they wrote and the contact they chose to give.",
      "Visitor addresses. To stop spam and guessing of passwords we use a visitor's internet address, but we keep it only in a scrambled form that cannot be turned back into the address.",
    ] },
    { h: "3. Who can see your pages", p: ["A page can be opened by anyone who has its link, unless you made it private or added a password or a lock. We do not publish a list of pages. Remember that people you share a link with can pass it on, so do not put on a page what you would not want a person with the link to see."] },
    { h: "4. Other companies that help us", ul: [
      "Cloudflare hosts the website and keeps the database and the files. Their servers may be outside India.",
      "Clerk handles signing in.",
      "Brevo sends emails when you or a guest ask for one. It receives the address and the message.",
      "Google Fonts supplies the lettering. When a page loads, the visitor's browser asks Google for the font files.",
      "If a page includes a YouTube, Vimeo, Spotify or OpenStreetMap item, the visitor's browser connects to that company when it loads. We use YouTube's privacy-enhanced mode.",
    ] },
    { h: "5. Cookies and your device", p: ["We use no advertising or tracking cookies and no analytics. Your browser keeps your drafts and photos on your device so you can work before signing in, and Clerk keeps the cookies needed to stay signed in."] },
    { h: "6. How long we keep things", ul: [
      "Until you delete them. A page you delete is removed for good within 30 days, together with photos that no page uses any more.",
      "If you delete your account, we remove your pages, photos, visitor messages, scheduled emails and templates straight away.",
      "Reports we have dealt with are kept for up to a year.",
      "We keep a short record of emails already sent, and of addresses that asked to stop, so that nothing is sent twice and a request to stop is always honoured.",
    ] },
    { h: "7. Your choices", ul: [
      "Delete a page from My pages, or your whole account from the Account page.",
      "Stop emails by using the link in any email we send.",
      `Ask for a copy of what we hold about you, or for something to be corrected, at ${mail}.`,
      "Report a page that shows you or your private details without your consent, with the “Report this page” link.",
    ] },
    { h: "8. Children", p: ["MadeForYou is meant for people aged 18 and over. Please do not put photos or details of a child on a page without the consent of the child's parent or guardian."] },
    { h: "9. Keeping data safe", p: ["Pages are sent over HTTPS. A locked or password page is not sent to anyone until the lock opens or the password is right. No service is perfectly safe, so please choose passwords you do not use elsewhere."] },
    { h: "10. Changes and complaints", p: [`If we change this page we will update the date at the top. If you are not happy with how we handled something, write to ${mail}. We read every message, and we try to act on serious reports within 3 days.`] },
  ],
};
