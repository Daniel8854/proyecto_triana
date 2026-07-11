require('dotenv').config();

const express = require('express');
const cors = require('cors');
const database = require('./src/database');
const routes = require('./src/routes');
const whatsappService = require('./src/whatsapp');
const cronJobs = require('./src/jobs/cron.jobs');

async function main() {
    await database.connect();
    console.log('✅ Conectado a Supabase');

    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use('/api', routes);

    const port = process.env.PORT || 3000;
    app.listen(port, () => console.log(`✅ API escuchando en puerto ${port}`));

    await whatsappService.initialize();
    cronJobs.init();
}

main().catch(error => {
    console.error('❌ Error al iniciar Triana:', error);
    process.exit(1);
});
