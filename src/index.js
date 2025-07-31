import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { connect, disconnect } from './db.js';

const app = express();
const port = 3033;

// Security middleware

app.use(cors());

app.use(helmet())

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!')
})

app.listen(port, () => {
    console.log(`App listening on port ${port}`)
})