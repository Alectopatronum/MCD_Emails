# MCD Email Template Guidelines

This document outlines the guidelines for creating and modifying email templates for the MCD automated email sender.

## Architecture

Email clients (Outlook, Gmail, Apple Mail, etc.) have wildly varying support for HTML and CSS. The layout provided in the reference design relies heavily on overlapping circles, complex positioning, and custom fonts. **Attempting to recreate this perfectly with HTML/CSS inside an email is impossible without it breaking in at least some clients.**

Therefore, we use an **Image-First Approach**:
1. The complex design is exported from Figma/Photoshop as a single, high-quality image (`.jpg` or `.png`).
2. The image is embedded inside a simple, robust HTML table structure.
3. The email script loops through recipients and sends this structure.

## Creating a New Template

1. **Design the Template:** Create your design in your preferred tool (Figma, Canva, Illustrator).
2. **Export the Image:** Export the final design. If there are sections that need to be text so they are selectable, you will need to slice the image and build a table layout, but for announcements, a single image is best. 
3. **Host the Image:** You can either:
   - Attach the image directly using Nodemailer (as done in `index.js`).
   - Host the image on a public URL (Imgur, an AWS S3 bucket, or your own server) and link it in the `template.html`. Using a public URL often results in a smaller email size and faster sending.
4. **Update `template.html`:** Modify `template.html` to update the alt text, preheader text, or image paths if necessary.

## HTML Best Practices for Emails

If you decide to add dynamic HTML text to the email, you MUST follow these rules:

- **Use Tables:** Do not use `<div>` for structural layout. Use `<table>`, `<tr>`, and `<td>`.
- **Inline CSS:** All CSS must be inline (`<td style="color: red;">`). Do not use `<style>` blocks in the `<head>` or external stylesheets, as many clients strip them.
- **No Flexbox/Grid:** Avoid modern CSS layouts (`display: flex;`, `display: grid;`, `position: absolute;`). They will break in Outlook.
- **Standard Web Safe Fonts:** If adding text, rely on web-safe fonts like Arial, Helvetica, Tahoma, Verdana, or Times New Roman as fallbacks.

## Dynamic Placeholders

If you need to insert the user's name (e.g., "Hi {{name}},"), you can add it to the `template.html`. The `index.js` script will replace `{{name}}` with the exact value from the `name` column in your Google Sheet or CSV.

*Example in template.html:*
```html
<p style="font-family: Arial, sans-serif; font-size: 16px; color: #333;">
  Hi {{name}},
</p>
```
Make sure your CSV has a column exactly titled `name`.
