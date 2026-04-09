import { NextResponse } from 'next/server';
import { RekognitionClient, DetectFacesCommand, DetectLabelsCommand, DetectFacesCommandInput } from '@aws-sdk/client-rekognition';

// Initialize the AWS Rekognition client using environment variables
// Note: In production you'd ensure these exist, but we mock graceful fallbacks for local dev without keys
const hasAwsKeys = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;
const rekognitionClient = hasAwsKeys
  ? new RekognitionClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
      sessionToken: process.env.AWS_SESSION_TOKEN,
    },
  })
  : null;

export async function POST(req: Request) {
  try {
    const { imageUrls } = await req.json();

    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json({ error: 'Missing imageUrls array' }, { status: 400 });
    }

    // If no keys, return a mocked success response simulating the AI parsing.
    if (!rekognitionClient) {
      console.log('AWS Keys missing. Using mock Rekognition engine.');
      const mockResults = imageUrls.map((url, i) => {
        const isBlurry = i % 5 === 0; // Arbitrary mock logic
        const hasClosedEyes = i % 7 === 0;
        return {
          url,
          flags: [
            ...(isBlurry ? [{ type: 'Blur', confidence: 92.5 }] : []),
            ...(hasClosedEyes ? [{ type: 'Closed Eyes', confidence: 85.1 }] : [])
          ]
        };
      });
      return NextResponse.json({ results: mockResults, isMock: true });
    }

    // If we have keys, actually parse with AWS Rekognition
    // Note: Rekognition requires image bytes (Uint8Array) or S3 object references.
    // For MVP, we would fetch the raw bytes of the public URL, then feed it to AWS.
    const results = await Promise.all(imageUrls.map(async (url) => {
      try {
        let fetchUrl = url;
        // Unsplash 'auto=format' parameter serves WEBP/AVIF which AWS Rekognition does not support. 
        // Force Unsplash urls to return raw JPGs for the ML evaluation.
        if (fetchUrl.includes('unsplash.com')) {
          fetchUrl = fetchUrl.replace('auto=format', 'fm=jpg');
        }

        // 1. Fetch bytes
        const imageResp = await fetch(fetchUrl);
        const arrayBuffer = await imageResp.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        // 2. Detect Faces (for blur and closed eyes)
        const faceParams: DetectFacesCommandInput = {
          Image: { Bytes: bytes },
          Attributes: ['ALL']
        };
        const faceData = await rekognitionClient.send(new DetectFacesCommand(faceParams));

        let flags: { type: string, confidence: number }[] = [];

        // Map AWS data to our business logic flags
        if (faceData.FaceDetails && faceData.FaceDetails.length > 0) {
          for (const face of faceData.FaceDetails) {
            // Only evaluate prominent faces to avoid flagging out-of-focus background crowds
            const isProminent = face.BoundingBox && face.BoundingBox.Width && face.BoundingBox.Width > 0.05;
            if (!isProminent) continue;

            // AWS returns Sharpness.Value (out of 100). Low sharpness = blurry.
            if (face.Quality && face.Quality.Sharpness && face.Quality.Sharpness < 60) {
              flags.push({ type: 'Blur', confidence: 100 - face.Quality.Sharpness });
            }
            // AWS EyeOpen confidence. If low -> closed eyes.
            // Note: EyesOpen.Value is a boolean, EyesOpen.Confidence tells us how sure it is about that boolean.
            if (face.EyesOpen && face.EyesOpen.Value === false) {
              flags.push({ type: 'Closed Eyes', confidence: face.EyesOpen.Confidence || 90 });
            }
          }
        }

        // Deduplicate flags so the UI doesn't say "Blur, Blur, Blur" 30 times for one photo
        const uniqueFlagsObj: Record<string, number> = {};
        for (const f of flags) {
          if (!uniqueFlagsObj[f.type] || f.confidence > uniqueFlagsObj[f.type]) {
            uniqueFlagsObj[f.type] = f.confidence;
          }
        }
        const uniqueFlags = Object.entries(uniqueFlagsObj).map(([type, confidence]) => ({ type, confidence }));

        return { url, flags: uniqueFlags };
      } catch (err: any) {
        console.error('Error analyzing image:', err);
        return { url, flags: [], error: err.message };
      }
    }));

    return NextResponse.json({ results, isMock: false });

  } catch (error: any) {
    console.error('API Error in /analyze:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
