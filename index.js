import axios from 'axios';
import createError from 'http-errors';
import express from 'express';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

const app = express();
const port = 80;
const s3 = new S3Client({
  forcePathStyle: false,
  endpoint: 'https://fra1.digitaloceanspaces.com',
  region: 'fra1',
  credentials: {
    accessKeyId: process.env.DIGITALOCEAN_USER,
    secretAccessKey: process.env.DIGITALOCEAN_PASSWORD
  }
});

app.disable('x-powered-by');
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(logger('dev'));

app.use((req, res, next) => {
  req.token = req.cookies.t || '';
  next();
});

const streamToString = (stream) => new Promise((resolve, reject) => {
  const chunks = [];
  stream.on('data', (chunk) => chunks.push(chunk));
  stream.on('error', reject);
  stream.on('end', () => resolve(Buffer.concat(chunks)));
});

app.get('/:name', (req, res, next) => {
  axios.get('https://api.digitalleman.com/v2/upload/files?filters[name]=' + req.params.name, {
    headers: {
      'authorization': `Bearer ${req.token}`
    }
  })
  .then((api) => {
    s3.send(new GetObjectCommand({
      Bucket: 'digitalleman',
      Key: 'private/' + api.data[0].hash + api.data[0].ext
    }))
    .then((data) => {
      res.set({
        'cache-control': 'max-age=3600',
        'content-type': data.ContentType
      });
      streamToString(data.Body).then((data) => {
        res.send(data);
      });
    });
  })
  .catch(function (error) {
    res.status(error.response.status);
    res.send();
  });
});

app.use(function(req, res, next) {
  next(createError(404));
});

app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = err;
  res.status(err.status || 500);
  res.send(err);
});

app.listen(port);