import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETS_DIR = path.join(__dirname, '..', 'assets', 'pdf-images');

// Helper function to check if image exists
function imageExists(filename) {
    return fs.existsSync(path.join(ASSETS_DIR, filename));
}

// Helper function to get image path
function getImagePath(filename) {
    return path.join(ASSETS_DIR, filename);
}

/**
 * Generate access guide PDF
 * @param {Object} options
 * @param {string} options.pinCode - The access PIN code
 * @param {string} options.ownerName - Name of the code owner (artist/production)
 * @param {string} [options.ownerDetails] - Additional owner details
 * @param {string} [options.contactName] - Contact person name
 * @returns {PDFDocument} - PDF document stream
 */
export function generateAccessGuidePDF(options) {
    const { pinCode, ownerName, ownerDetails = '', contactName = 'Sylvester Erbs Ledet' } = options;

    const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
            Title: `Adgangsvejledning - ${ownerName}`,
            Author: 'TourCare ApS',
        }
    });

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - 100; // margins

    // ========== PAGE 1: Code & Info ==========

    // Header - TOURCARE
    doc.fontSize(36)
       .font('Helvetica-Bold')
       .text('TOURCARE', { align: 'center' });

    doc.moveDown(0.5);

    // Subtitle
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .text('ADGANGSVEJLEDNING', { align: 'center' });

    doc.moveDown(2);

    // KODE section
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('KODE', 50);

    doc.moveDown(0.5);

    doc.fontSize(11)
       .font('Helvetica')
       .text('Hver produktion har en unik kode, som kan bruges', 50)
       .text('døgnet rundt, alle ugens dage.', 50);

    doc.moveDown(1.5);

    // Code display - centered
    doc.fontSize(12)
       .font('Helvetica')
       .text('Jeres kode til portene er:', { align: 'center' });

    doc.moveDown(0.3);

    doc.fontSize(28)
       .font('Helvetica-Bold')
       .text(`${pinCode} # or ↵`, { align: 'center' });

    doc.moveDown(2);

    // Two columns: KODEN TILHØRER and ADRESSE
    const colY = doc.y;
    const col1X = 50;
    const col2X = pageWidth / 2 + 20;

    // Column 1: KODEN TILHØRER
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('KODEN TILHØRER', col1X, colY);

    doc.moveDown(0.5);
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .text(ownerName, col1X);

    if (ownerDetails) {
        doc.fontSize(10)
           .font('Helvetica-Oblique')
           .text(ownerDetails, col1X);
    }

    // Column 2: ADRESSE
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('ADRESSE', col2X, colY);

    doc.fontSize(11)
       .font('Helvetica')
       .text('Tourcare ApS', col2X, doc.y + 8)
       .text('Høffdingsvej 32A', col2X)
       .text('2500 Valby', col2X);

    doc.moveDown(3);

    // Map links
    const linkY = doc.y;
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Find på:', pageWidth / 2 - 80, linkY)
       .text('Find på:', pageWidth / 2 + 40, linkY);

    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#0000EE')
       .text('Google Maps', pageWidth / 2 - 80, linkY + 14, {
           link: 'https://maps.google.com/?q=Høffdingsvej+32A,+2500+Valby',
           underline: true
       })
       .text('Apple Maps', pageWidth / 2 + 40, linkY + 14, {
           link: 'https://maps.apple.com/?q=Høffdingsvej+32A,+2500+Valby',
           underline: true
       });

    doc.fillColor('#000000');

    // Footer
    addFooter(doc, 1, 4, contactName);

    // ========== PAGE 2: Ankomst ==========
    doc.addPage();

    doc.fontSize(18)
       .font('Helvetica-Bold')
       .text('ANKOMST', 50, 50);

    doc.moveDown(1);

    doc.fontSize(13)
       .font('Helvetica')
       .text('Kør ind ad porten ved "Arca"-skiltet, fortsæt lige ud og', 50)
       .text('drej til venstre for enden af bygningen.', 50);

    doc.moveDown(0.5);

    doc.fontSize(13)
       .font('Helvetica')
       .text('Kør ned ad rampen til porten.', 50);

    doc.moveDown(1.5);

    // Map image
    if (imageExists('map.jpg')) {
        doc.image(getImagePath('map.jpg'), 50, doc.y, {
            width: contentWidth,
            align: 'center'
        });
    } else if (imageExists('map.png')) {
        doc.image(getImagePath('map.png'), 50, doc.y, {
            width: contentWidth,
            align: 'center'
        });
    } else {
        doc.fontSize(10)
           .fillColor('#666666')
           .text('[Kort billede mangler - tilføj map.jpg til assets/pdf-images]', 50, doc.y, { align: 'center' });
        doc.fillColor('#000000');
    }

    addFooter(doc, 2, 4, contactName);

    // ========== PAGE 3: Indgang ==========
    doc.addPage();

    doc.fontSize(18)
       .font('Helvetica-Bold')
       .text('INDGANG', 50, 50);

    doc.moveDown(1);

    doc.fontSize(13)
       .font('Helvetica')
       .text('Der er ', 50, doc.y, { continued: true })
       .font('Helvetica-Bold')
       .text('to', { continued: true })
       .font('Helvetica')
       .text(' porte: "Yderport" & "Sluseport".');

    doc.moveDown(0.5);

    doc.fontSize(13)
       .font('Helvetica')
       .text('Koden virker til begge porte og alarmen frakobles', 50)
       .text('automatisk, når koden tastes.', 50);

    doc.moveDown(1.5);

    // Keypad images - two columns
    const imgY = doc.y;
    const imgWidth = (contentWidth - 20) / 2;

    doc.fontSize(10)
       .font('Helvetica')
       .text('Kodetastatur til "Yderport"', 50, imgY)
       .text('Kodetastatur til "Sluseport"', 50 + imgWidth + 20, imgY);

    const keypadImgY = imgY + 20;

    if (imageExists('keypad-outer.jpg')) {
        doc.image(getImagePath('keypad-outer.jpg'), 50, keypadImgY, { width: imgWidth });
    } else {
        doc.rect(50, keypadImgY, imgWidth, 250).stroke('#CCCCCC');
        doc.fontSize(9).fillColor('#999999').text('[keypad-outer.jpg]', 50, keypadImgY + 120, { width: imgWidth, align: 'center' });
        doc.fillColor('#000000');
    }

    if (imageExists('keypad-inner.jpg')) {
        doc.image(getImagePath('keypad-inner.jpg'), 50 + imgWidth + 20, keypadImgY, { width: imgWidth });
    } else {
        doc.rect(50 + imgWidth + 20, keypadImgY, imgWidth, 250).stroke('#CCCCCC');
        doc.fontSize(9).fillColor('#999999').text('[keypad-inner.jpg]', 50 + imgWidth + 20, keypadImgY + 120, { width: imgWidth, align: 'center' });
        doc.fillColor('#000000');
    }

    addFooter(doc, 3, 4, contactName);

    // ========== PAGE 4: Udgang ==========
    doc.addPage();

    doc.fontSize(18)
       .font('Helvetica-Bold')
       .text('UDGANG', 50, 50);

    doc.moveDown(1);

    doc.fontSize(13)
       .font('Helvetica')
       .text('Yderporten lukker automatisk efter få minutter, men kan', 50)
       .text('åbnes igen indefra.', 50);

    doc.moveDown(0.5);

    doc.fontSize(13)
       .font('Helvetica-Bold')
       .text('Husk ', 50, doc.y, { continued: true })
       .font('Helvetica')
       .text('at lukke "Sluseport" manuelt, når I forlader slusen.');

    doc.moveDown(1.5);

    // Button images - two columns
    const btnImgY = doc.y;

    doc.fontSize(10)
       .font('Helvetica')
       .text('Knap til sluseport', 50, btnImgY)
       .text('Knap til yderport', 50 + imgWidth + 20, btnImgY);

    const buttonImgY = btnImgY + 20;

    if (imageExists('button-inner.jpg')) {
        doc.image(getImagePath('button-inner.jpg'), 50, buttonImgY, { width: imgWidth });
    } else {
        doc.rect(50, buttonImgY, imgWidth, 250).stroke('#CCCCCC');
        doc.fontSize(9).fillColor('#999999').text('[button-inner.jpg]', 50, buttonImgY + 120, { width: imgWidth, align: 'center' });
        doc.fillColor('#000000');
    }

    if (imageExists('button-outer.jpg')) {
        doc.image(getImagePath('button-outer.jpg'), 50 + imgWidth + 20, buttonImgY, { width: imgWidth });
    } else {
        doc.rect(50 + imgWidth + 20, buttonImgY, imgWidth, 250).stroke('#CCCCCC');
        doc.fontSize(9).fillColor('#999999').text('[button-outer.jpg]', 50 + imgWidth + 20, buttonImgY + 120, { width: imgWidth, align: 'center' });
        doc.fillColor('#000000');
    }

    addFooter(doc, 4, 4, contactName);

    return doc;
}

function addFooter(doc, pageNum, totalPages, contactName) {
    const pageHeight = doc.page.height;
    const footerY = pageHeight - 60;

    // Horizontal line
    doc.moveTo(50, footerY)
       .lineTo(doc.page.width - 50, footerY)
       .stroke('#000000');

    // Footer text
    doc.fontSize(9)
       .font('Helvetica')
       .text('I nødstilfælde kontakt:', 50, footerY + 10, { align: 'center', width: doc.page.width - 100 });

    doc.fontSize(9)
       .font('Helvetica-Bold')
       .text('Hovednummer +45 3227 6666', 50, footerY + 22, { align: 'center', width: doc.page.width - 100, continued: true })
       .font('Helvetica')
       .text(' (vent for akuttelefon)');

    doc.fontSize(9)
       .font('Helvetica')
       .text(`eller jeres projektleder `, 50, footerY + 34, { align: 'center', width: doc.page.width - 100, continued: true })
       .font('Helvetica-Bold')
       .text(contactName);

    // Page number
    doc.fontSize(9)
       .font('Helvetica')
       .text(`${pageNum}/${totalPages}`, doc.page.width - 70, footerY + 22);
}

export default { generateAccessGuidePDF };
