import React, { useEffect, useState } from 'react';
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import en from './en.json'
import config from './mespeak_config.json'
const mespeak  = require('mespeak');
const ffmpeg = createFFmpeg({ log: true });

// eslint-disable-next-line @typescript-eslint/no-redeclare
function App() {
  const [ready, setReady] = useState(false);

  const load = async () => {
    mespeak.loadConfig(config)
    mespeak.loadVoice(en)
    await ffmpeg.load();
    setReady(true);
  };

  useEffect(() => {
    load();
  }, []);
 
  const processChunk = async (file: string): Promise<Uint8Array> => {
    return new Promise(async (resolve, reject) => {
        // Extract chunk number from file name, without leading zeros at the beginning, but allowing a single 
        const chunk = file.match(/out0*([1-9][0-9]*)/);
        const chunkNumber = chunk ? chunk[1] : '0';
        // Convert chunk number to audio
        const ttsBuffer: ArrayBuffer = mespeak.speak("chunk " + chunkNumber, { rawdata: "arraybuffer" });
        ffmpeg.FS('writeFile', 'chunkName.wav', new Uint8Array(ttsBuffer));

        // Reduce volume of TTS audio by 75%
        await ffmpeg.run('-i', 'chunkName.wav', '-filter:a', 'volume=0.25', 'volume_reduced_chunkName.wav');

        // Convert the original chunk from MP3 to WAV
        await ffmpeg.run('-i', file, 'original.wav');

        // Resample both volume-reduced chunkName and original to ensure same sample rate
        await ffmpeg.run('-i', 'volume_reduced_chunkName.wav', '-ar', '44100', 'resampled_chunkName.wav');
        await ffmpeg.run('-i', 'original.wav', '-ar', '22050', 'resampled_original.wav');

        // Write the list of files to concatenate
        ffmpeg.FS('writeFile', 'files.txt', new Uint8Array(new TextEncoder().encode('file \'resampled_chunkName.wav\'\nfile \'resampled_original.wav\'')));

        // Concatenate the chunk name audio and the chunk in WAV format
        await ffmpeg.run('-f', 'concat', '-safe', '0', '-i', 'files.txt', 'concat.wav');

        // Convert the concatenated WAV back to MP3
        await ffmpeg.run('-i', 'concat.wav', '-codec:a', 'libmp3lame', '-qscale:a', '2', 'concat_' + file + '.mp3');

        // Read the concatenated chunk
        const data = ffmpeg.FS('readFile', 'concat_' + file + '.mp3');

        // Delete temporary files
        ffmpeg.FS('unlink', 'chunkName.wav');
        ffmpeg.FS('unlink', 'volume_reduced_chunkName.wav');
        ffmpeg.FS('unlink', 'concat.wav');
        ffmpeg.FS('unlink', 'resampled_chunkName.wav');
        ffmpeg.FS('unlink', 'resampled_original.wav');
        ffmpeg.FS('unlink', 'files.txt');

        resolve(data);
    });
};
 

 
  // Refactored the mespeak and ffmpeg logic to a separate function
  const convertAndSplit = async (file:File) => {
    // Read the file
    ffmpeg.FS('writeFile', 'test.m4b', await fetchFile(file));

    // Convert to MP3
    await ffmpeg.run('-i', 'test.m4b', '-codec:a', 'libmp3lame', '-qscale:a', '2', 'input.mp3');

    // Split the MP3
    await ffmpeg.run('-i', 'input.mp3', '-f', 'segment', '-segment_time', '600', '-c', 'copy', 'out%03d.mp3');

    // Create a new JSZip instance
    const zip = new JSZip();

    // Iterate over the chunks
    const chunkFiles = ffmpeg.FS('readdir', '/').filter(file => file.startsWith('out'));
    for (let file of chunkFiles) {
      const data = await processChunk(file);
      
      // Add the concatenated chunk to the ZIP
      zip.file('concat_' + file, data);
    }

    // Generate the ZIP file
    const zipFile = await zip.generateAsync({ type: 'blob' });

    // Download the ZIP file
    saveAs(zipFile, 'chunks.zip');
  };

  if (!ready) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Audio Chunker</h1>
      <input type="file" onChange={(e) => {
        if (!e.target.files) return;
        convertAndSplit(e.target.files[0])}} />
    </div>
  );
}

export default App;
