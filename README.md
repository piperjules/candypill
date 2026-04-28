# Candy Pill Website Rebuild

Static site rebuild of the Candy Pill portfolio, ready for GitHub Pages + custom domain.

## Files

- `index.html` main page structure/content
- `styles.css` responsive styling
- `CNAME` custom domain target (`piperjules.com`)

## Deploy To GitHub Pages

1. Create a new GitHub repo (for example: `candypill-site`).
2. Upload these files to the repo root.
3. In GitHub: **Settings -> Pages**.
4. Under **Build and deployment**, set:
   - **Source**: Deploy from a branch
   - **Branch**: `main` and `/ (root)`
5. Save, then wait for the first deployment.

## Point `piperjules.com` to GitHub Pages

Set DNS records at your domain provider:

- `A` record for host `@` to:
  - `185.199.108.153`
  - `185.199.109.153`
  - `185.199.110.153`
  - `185.199.111.153`
- `CNAME` record for host `www` to: `<your-github-username>.github.io`

Then in the repo **Settings -> Pages**, ensure custom domain is `piperjules.com` and enable HTTPS.
