const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// Configure R2 (It uses the S3 protocol)
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
  }
  
  try {
    const { fileName, fileType } = JSON.parse(event.body);
    
    // Create a unique file name to prevent overwrites
    const uniqueName = `${Date.now()}_${fileName.replace(/\s+/g, '-')}`;

    // Prepare the upload command
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: uniqueName,
      ContentType: fileType,
      // ACL: 'public-read' // Uncomment if your bucket requires ACLs for public access
    });

    // Generate the Pre-Signed URL (valid for 60 seconds)
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 });
    
    // The public URL where the file can be viewed after upload
    // NOTE: Replace 'pub-xxx.r2.dev' with your actual R2 Public Domain or Custom Domain
    // You can find this in Cloudflare R2 Bucket Settings -> Public Access
    const publicDomain = process.env.R2_PUBLIC_DOMAIN || `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev`;
    const publicUrl = `${publicDomain}/${uniqueName}`;

    return {
      statusCode: 200,
      body: JSON.stringify({ uploadUrl, publicUrl }),
    };

  } catch (err) {
    console.error("R2 Error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};