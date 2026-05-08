# QR Card

Digital business card generator with QR codes, built with HTML, CSS, vanilla JavaScript, Node.js, Express, and the `qrcode` npm package.

## Features

- Create a digital business card from name, role, LinkedIn, GitHub, and email fields.
- Generate a unique public card URL like `/card/gabriel-silva`.
- Generate a QR code that points to the public card URL.
- Render a mobile-friendly business card page for scans.
- Persist cards in `data/cards.json` without requiring a database.

## Local Development

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm start
```

Open:

```text
http://localhost:3000
```

## Environment

The app runs on port `3000` by default.

For production QR codes, set `PUBLIC_BASE_URL` to the public Lightsail URL or IP:

```bash
PUBLIC_BASE_URL=http://YOUR_LIGHTSAIL_PUBLIC_IP:3000 npm start
```

## AWS Lightsail Deployment

1. Create an Ubuntu Lightsail instance.
2. Open port `3000` in the Lightsail firewall.
3. SSH into the instance with your `.pem` key.
4. Install Node.js and npm.
5. Clone this repository.
6. Run `npm install`.
7. Start with PM2:

```bash
npm install -g pm2
PUBLIC_BASE_URL=http://YOUR_LIGHTSAIL_PUBLIC_IP:3000 pm2 start server.js --name qrcard
pm2 save
pm2 startup
```

Then visit:

```text
http://YOUR_LIGHTSAIL_PUBLIC_IP:3000
```
