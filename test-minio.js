const Minio = require('minio');

async function run() {
  console.log('Testing localhost...');
  try {
    const client = new Minio.Client({
      endPoint: 'localhost',
      port: 9000,
      useSSL: false,
      accessKey: 'minioadmin',
      secretKey: 'minioadmin_dev_password',
    });
    const exists = await client.bucketExists('saleassist');
    console.log('localhost success, bucket exists:', exists);
  } catch (err) {
    console.error('localhost failed:', err);
  }

  console.log('Testing 127.0.0.1...');
  try {
    const client = new Minio.Client({
      endPoint: '127.0.0.1',
      port: 9000,
      useSSL: false,
      accessKey: 'minioadmin',
      secretKey: 'minioadmin_dev_password',
    });
    const exists = await client.bucketExists('saleassist');
    console.log('127.0.0.1 success, bucket exists:', exists);
  } catch (err) {
    console.error('127.0.0.1 failed:', err);
  }
}

run();
