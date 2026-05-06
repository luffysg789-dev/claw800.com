# Lucky Star Investment Website Design

## Goal

Build a standalone bilingual corporate website for LUCKY STAR INVESTMENT L.L.C, a Dubai-registered investment company, using the provided registration summary and office photography to establish credibility for Chinese and international visitors.

## Audience

The site should serve Chinese-speaking partners and English-speaking international visitors. The primary user intent is to quickly understand who the company is, what sectors it invests in, whether it is properly registered in Dubai, and how to contact the office.

## Recommended Approach

Create a single-page bilingual website under `public/lucky-star/`. A language toggle switches all visible copy between Chinese and English without leaving the page. This keeps the site easy to host, easy to share, and consistent with the existing static page patterns in this repository.

## Information Architecture

The page contains these sections:

- Hero: company name, bilingual positioning, Dubai registration signal, and office image.
- Company profile: concise overview of the company, ownership, location, and investment focus.
- Investment sectors: grouped sectors including technology, commerce, industry, agriculture, energy, oil and gas, water, healthcare, education, tourism, retail, sport, and space projects.
- Registration credentials: license number, commercial register number, chamber membership number, capital, valid dates, and legal form.
- Office environment: photo gallery from the supplied office images.
- Contact: mobile, email, and Dubai Investment Park office address.

## Visual Direction

The visual style should be professional, restrained, and international. It should use the provided office photos as real trust-building assets, with a neutral white/charcoal base and measured red/green brand accents inspired by the Lucky Star logo. It should avoid exaggerated marketing language, decorative clutter, and one-note color treatment.

## Content Rules

The site can state the company registration facts provided by the user. It should avoid unsupported claims such as guaranteed returns, fund performance, regulatory approvals beyond the listed Dubai business registration, or investment advice. Contact information should be visible but not aggressive.

## Technical Design

Files:

- `public/lucky-star/index.html`: static HTML structure and bilingual text data attributes.
- `public/lucky-star/style.css`: responsive layout, typography, gallery, and section styling.
- `public/lucky-star/script.js`: language toggle and small interactive behavior.
- `public/lucky-star/assets/`: copied office images used by the page.
- `tests/lucky-star-page.test.js`: static checks for required content, bilingual support, image references, and script hooks.

The page should work through the existing Express static server and be reachable at `/lucky-star/`.

## Testing

Use Node's built-in test runner for static checks. Verify the page includes the core registration identifiers, bilingual controls, contact information, and all referenced local images exist. Also run a local server and inspect the page in a browser-sized viewport if feasible.

## Self Review

The design is scoped to one independent static corporate site, does not modify existing app behavior, and uses user-provided facts without inventing financial claims. The file boundaries are clear and testable.
