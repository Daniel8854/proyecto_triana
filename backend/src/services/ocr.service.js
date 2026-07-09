const Tesseract = require('tesseract.js');

class OCRService {
    async leerImagen(base64Image) {
        try {
            // Remover metadata del base64 si existe
            const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
            
            // Procesar imagen con Tesseract
            const { data: { text } } = await Tesseract.recognize(
                Buffer.from(base64Data, 'base64'),
                'por', // Portugués (puedes cambiar a 'spa' para español)
                {
                    logger: m => console.log(m) // Opcional: para ver progreso
                }
            );
            
            console.log('Texto extraído:', text);
            return text;
            
        } catch (error) {
            console.error('Error en OCR:', error);
            throw new Error('No se pudo leer la imagen');
        }
    }
    
    // Para Google Cloud Vision (mejor precisión)
    async leerImagenGoogleVision(base64Image) {
        // Requiere instalar @google-cloud/vision
        const vision = require('@google-cloud/vision');
        const client = new vision.ImageAnnotatorClient();
        
        const [result] = await client.textDetection({
            image: { content: base64Image }
        });
        
        const detections = result.textAnnotations;
        return detections[0]?.description || '';
    }
}

module.exports = new OCRService();