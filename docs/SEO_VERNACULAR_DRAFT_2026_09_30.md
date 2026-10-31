# AquaTerra vernacular and Hinglish SEO: draft for approval

Status: DRAFT. Nothing in this file is live. A Bengali and Hindi reader must approve the wording (section 6) before any of it goes into the code.

Scope chosen: Bengali script, Banglish (Bengali in English letters), Hinglish (Hindi in English letters), Hindi (Devanagari). Depth chosen: metadata plus a multilingual FAQ. No new routes, no `hreflang`, no layout change.

## 1. What is true today

Established from the code:

- `index.html` is `lang="en"`. Title, description, keywords and Open Graph text are English only.
- The homepage JSON-LD (`Organization`) has no `alternateName` and no language markup.
- `/faq` and `/volunteer` share one English question list (`src/lib/faqData.ts`) and emit `FAQPage` JSON-LD from it.
- Per-route titles and descriptions come from `src/lib/metaConfig.ts` (client) and `scripts/prerender-meta.mjs` (prerendered HTML). Both must change together or the crawler and the browser disagree.

## 2. What will and will not work (read this before approving)

- **Established:** Google ignores the `<meta name="keywords">` tag. Adding vernacular phrases there does nothing for Google. It is harmless, so it is included only for other engines.
- **Established:** Google matches queries against visible page text, titles, headings and anchor text. Vernacular phrases only help where they appear as real, readable text on a crawlable page.
- **Established:** Since 2023, Google shows FAQ rich results only for well-known government and health sites. AquaTerra will not get FAQ rich results. FAQ JSON-LD is still fine to keep, but the value here is the visible FAQ text, not the markup.
- **My inference:** Most searchers for a Kolkata student NGO type in English or Banglish. Bengali script and Devanagari queries are rarer for this topic, so the FAQ text (section 5) carries the most weight and the metadata additions carry less.
- **Genuine uncertainty:** I cannot see Search Console or query volumes from this sandbox. The phrase bank below is written from how people plausibly search, not from measured data. Ask whoever has Search Console access to check the Queries report for any of these phrases and reorder the list by real impressions.

## 3. Phrase bank

Grouped by what the searcher wants. Each row is a phrase to appear in visible text or metadata, not a list to stuff into one tag.

### Find the NGO

| Language | Phrases |
|---|---|
| English (already covered) | NGO Kolkata, student NGO Kolkata, youth NGO Kolkata |
| Banglish | kolkata te ngo, kolkatar student ngo, kolkata ngo volunteer |
| Bengali | কলকাতার এনজিও, কলকাতার স্টুডেন্ট এনজিও, ছাত্রছাত্রীদের সংস্থা কলকাতা |
| Hinglish | kolkata ka ngo, kolkata mein student ngo, kolkata ngo volunteer kaise bane |
| Hindi | कोलकाता एनजीओ, कोलकाता में छात्र एनजीओ |

### Volunteer or join

| Language | Phrases |
|---|---|
| Banglish | kolkata te volunteer hobo kibhabe, ngo te join korbo kibhabe, student volunteer kolkata |
| Bengali | কলকাতায় ভলান্টিয়ার হওয়ার উপায়, এনজিওতে যোগ দিতে চাই |
| Hinglish | kolkata mein volunteer kaise bane, students ke liye ngo kolkata, free volunteering kolkata |
| Hindi | कोलकाता में वॉलंटियर कैसे बनें, छात्रों के लिए एनजीओ |

### Programmes

| Programme | Banglish and Hinglish | Bengali and Hindi |
|---|---|---|
| Tree planting | kolkata te gachh lagano, kolkata mein ped lagana | গাছ লাগানো কলকাতা, कोलकाता में पौधारोपण |
| Free education for children | free padhai kolkata, gorib bachchader porashona | বিনামূল্যে পড়াশোনা কলকাতা, गरीब बच्चों की मुफ्त पढ़ाई |
| Welfare and donations | ngo ko donate kaise kare, kolkata charity | কলকাতায় দান করবেন কীভাবে, कोलकाता में दान कैसे करें |
| Certificates for volunteers | volunteer certificate kolkata, internship certificate ngo | ভলান্টিয়ার সার্টিফিকেট, वॉलंटियर प्रमाणपत्र |

### TerraThon

| Language | Phrases |
|---|---|
| Banglish and Hinglish | kolkata sports tournament school students, cricket tournament kolkata 2026, fifa tournament kolkata, pickleball kolkata |
| Bengali and Hindi | কলকাতায় ক্রিকেট টুর্নামেন্ট, स्कूल छात्रों के लिए टूर्नामेंट कोलकाता |

## 4. Proposed metadata changes

Keep the English title first. Add vernacular text after it and stay inside the length limits (title about 60 characters, description about 155).

- **Homepage description:** append one short line, for example: `কলকাতার ছাত্রছাত্রীদের এনজিও | kolkata ka student ngo`. Reviewer decides the final line.
- **Organization JSON-LD:** add `"alternateName": ["আকোয়াটেরা", "एक्वाटेरा", "Aqua Terra", "AQ Kolkata"]` and `"knowsLanguage": ["en", "bn", "hi"]`. Reviewer confirms the spellings people actually use.
- **Homepage keywords tag:** append the Banglish and Hinglish phrases from section 3 (low value, see section 2).
- **`/volunteer` and `/join`:** description gets the "kaise bane / kibhabe hobo" phrasing once, in natural wording.
- **`/projects`, `/faq`, `/terrathon`:** one vernacular clause each in the description.
- Each change lands in three places: `metaConfig.ts`, `prerender-meta.mjs`, and `index.html` for the homepage.

## 5. Draft FAQ entries (visible text, the part that matters most)

Add these to `src/lib/faqData.ts` as a new cluster shown under the English questions on `/faq`. Each answer is one or two plain sentences and links to the same facts the English answers give (fees, approval time and so on come from `orgFacts`, never typed in twice).

1. **Kolkata te volunteer hobo kibhabe? (Banglish)** Login page e Google diye sign in korlei apnar application shuru hoy. Approval howar por apni team e join korte paren.
2. **কলকাতায় ভলান্টিয়ার হতে কত টাকা লাগে? (Bengali)** কোনও ফি লাগে না। AquaTerra-তে যোগ দেওয়া সম্পূর্ণ বিনামূল্যে।
3. **Kolkata mein volunteer kaise bane? (Hinglish)** Login page par Google se sign in karein. Aapka application wahin se shuru ho jata hai, aur approval ke baad aap team join kar sakte hain.
4. **क्या AquaTerra में जुड़ने के लिए फीस लगती है? (Hindi)** नहीं। AquaTerra से जुड़ना बिल्कुल मुफ्त है।
5. **AquaTerra ki ngo ki ki kaj kore? (Banglish)** Amra Kolkata te gachh lagano, bachchader free porashona, ebong welfare projects chalai. Sob kichu student der dwara chalano hoy.
6. **AquaTerra kya kaam karta hai? (Hinglish)** Hum Kolkata mein paudhaaropan, bachchon ki free padhai aur welfare projects chalate hain. Sab kuch students khud chalate hain.
7. **আমি কি স্কুলের ছাত্র হয়ে যোগ দিতে পারি? (Bengali)** হ্যাঁ। AquaTerra একটি ছাত্র-পরিচালিত সংস্থা, তাই স্কুল ও কলেজের ছাত্রছাত্রীরা যোগ দিতে পারে।
8. **TerraThon mein kaun khel sakta hai? (Hinglish)** 1 January 2005 ya uske baad janme students. Cricket, pickleball aur FIFA ke rules aur registration TerraThon page par hain.

Facts in these drafts that must be checked against `faqData.ts` and `orgFacts` before approval: "no fee", "Google sign in", "approval before joining", "school and college students". If the English answers differ, the English answers win.

## 6. Review checklist for the native reader

- [ ] Every Bengali and Devanagari sentence reads naturally to a local speaker, not like a translation.
- [ ] Banglish and Hinglish spellings match how people type (for example `kibhabe` vs `kivabe`, `paudhaaropan` vs `paudharopan`). Pick one spelling per word and use it everywhere.
- [ ] The organisation's Bengali and Hindi spellings of the name are the ones people use.
- [ ] No claim appears that the English pages do not make.
- [ ] Phrase bank order matches real Search Console impressions if that data is available.

## 7. Implementation plan once approved

1. Add the approved FAQ entries to `faqData.ts` with a `lang` field, render them under the English clusters on `/faq`, and mark each block with the `lang` attribute (`bn`, `hi`, `en`) so browsers and screen readers pick the right font and voice.
2. Update `metaConfig.ts`, `prerender-meta.mjs` and `index.html` together.
3. Add `alternateName` and `knowsLanguage` to the Organization JSON-LD.
4. Check the fonts: NeutralFace and Eina do not cover Bengali or Devanagari, so the vernacular text needs a fallback font stack (Noto Sans Bengali, Noto Sans Devanagari, self-hosted like the other fonts). Without this the text renders as boxes.
5. Run `npm run build`, `npm test` and `npm run lint`, then view `/faq` at 390 and 1440 wide.
6. Open a separate PR from PR #31. After it deploys, submit `/faq` and the homepage for indexing in Search Console and watch the Queries report for these phrases over four to six weeks.

## 8. Risks

- **Font coverage (item 4 above)** is the one real build risk. It is easy to miss because English text still renders fine.
- **Keyword stuffing** in titles hurts more than it helps. The plan keeps one vernacular clause per description.
- **Unreviewed translation** on a public NGO site is a reputational risk, which is why nothing ships before section 6 is signed off.
