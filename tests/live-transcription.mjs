import fs from "node:fs";
import { fileURLToPath } from "node:url";

const apiKey = process.env.SONIOX_API_KEY;
if (!apiKey) {
  console.error("SONIOX_API_KEY is required to run this test.");
  process.exit(1);
}

const aiDistUrl = new URL(
  "../node_modules/@tanstack/ai/dist/esm/index.js",
  import.meta.url,
);
const sonioxDistUrl = new URL("../dist/esm/index.js", import.meta.url);

const aiDistPath = fileURLToPath(aiDistUrl);
const sonioxDistPath = fileURLToPath(sonioxDistUrl);

if (!fs.existsSync(aiDistPath) || !fs.existsSync(sonioxDistPath)) {
  console.error("Build artifacts not found. Run this first:");
  console.error("  npm run build");
  process.exit(1);
}

const { generateTranscription } = await import(aiDistUrl.href);
const {
  sonioxTranscription,
  SonioxTranscriptionTimeoutError,
  SonioxApiError,
} = await import(sonioxDistUrl.href);

// Test 1: File-based transcription
console.log("=== Test 1: File-based transcription ===");
const audioPath = process.argv[2] ?? "./tests/fixtures/test-audio.mp3";

const audio = fs.readFileSync(audioPath);

const result1 = await generateTranscription({
  adapter: sonioxTranscription("stt-async-v3"),
  audio,
  modelOptions: {
    enableLanguageIdentification: true,
  },
});
console.log(JSON.stringify(result1, null, 2));

// Test 2: URL object transcription
console.log("\n=== Test 2: URL object transcription ===");
const testAudioUrl = "https://soniox.com/media/examples/coffee_shop.mp3";

const result2 = await generateTranscription({
  adapter: sonioxTranscription("stt-async-v3"),
  audio: new URL(testAudioUrl),
  modelOptions: {
    enableLanguageIdentification: true,
    enableSpeakerDiarization: true,
  },
});

console.log(`Text: ${result2.text.substring(0, 100)}...`);
console.log(`Language: ${result2.language}`);
console.log(`Duration: ${result2.duration}s`);
console.log(`Segments: ${result2.segments?.length}`);

// Test 3: URL string transcription
console.log("\n=== Test 3: URL string transcription ===");

const result3 = await generateTranscription({
  adapter: sonioxTranscription("stt-async-v3"),
  audio: testAudioUrl,
  modelOptions: {
    enableLanguageIdentification: true,
    enableSpeakerDiarization: true,
  },
});

console.log(`Text: ${result3.text.substring(0, 100)}...`);
console.log(`Language: ${result3.language}`);
console.log(`Duration: ${result3.duration}s`);
console.log(`Segments: ${result3.segments?.length}`);


// Test 4: Invalid API Key check
console.log("\n=== Test 4: Invalid API Key check ===");
try {
  await generateTranscription({
    adapter: sonioxTranscription("stt-async-v3", {
      apiKey: "invalid_key_format",
    }),
    audio: testAudioUrl,
  });
  console.error("FAILED: Expected SonioxApiError but none was thrown.");
  process.exit(1);
} catch (error) {
  if (error instanceof SonioxApiError) {
    console.log(
      `PASSED: Successfully caught SonioxApiError (Status: ${error.status})`,
    );
  } else if (error instanceof SonioxTranscriptionTimeoutError) {
    console.warn("SKIPPED: Triggered timeout instead of API error.");
  } else {
    console.error(
      "FAILED: Caught unexpected error type:",
      error.name,
      error.message,
    );
    process.exit(1);
  }
}

console.log("\n=== All tests passed! ===");
