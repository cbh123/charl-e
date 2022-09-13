import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import 'tailwindcss/tailwind.css';
import './App.css';
import { useState, useEffect } from 'react';
import Confetti from 'react-confetti';
import Sparkles from './Sparkle';
const shell = window.electron.shellAPI;

export function Prompt(props) {
  const defaultArgs = [
    '--outdir',
    props.outDir,
    '--ckpt',
    props.weightDir,
    '--ddim_steps',
    '5',
    '--n_samples',
    '1',
    '--seed',
    '42',
  ];
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [args, setArgs] = useState<string[]>(defaultArgs);
  const [showOptions, setShowOptions] = useState(false);
  const [outDir, setOutDir] = useState(props.outDir);
  const [ddimSteps, setDdimSteps] = useState(5);
  const [numSamples, setNumSamples] = useState(1);
  const [seed, setSeed] = useState(42);
  const [plms, setPlms] = useState('on');
  const [weights, setWeights] = useState(props.weightDir);
  const [error, setError] = useState(false);

  const handlePrompt = (prompt) => {
    if (!loading) {
      setPrompt(prompt);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!loading) {
      window.electron.ipcRenderer.runPrompt({ prompt: prompt, args: args });
    }
    setLoading(true);
    setError(false);
  };

  const reset = () => {
    setOutDir(props.outDir);
    setPlms(false);
    setNumSamples(1);
    setDdimSteps(5);
    setWeights(props.weightDir);
    setSeed(42);
    setArgs(defaultArgs);
  };

  const handleCancel = async (e) => {
    window.electron.ipcRenderer.sendMessage('cancel-run', {});
    setLoading(false);
  };

  const handleOptionsSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    const res: string[] = Object.entries(Object.fromEntries(formData))
      .flat()
      .filter((item) => item !== 'on');

    setArgs(res);
    console.log(args);
    setShowOptions(false);
  };

  window.electron.ipcRenderer.on('image-load', (file) => {
    setLoading(false);
  });

  window.electron.ipcRenderer.on('error', (error) => {
    setError(true);
    setLoading(false);
  });

  useEffect(() => {
    setShowOptions(props.showOptions);
  }, [props.outDir, props.showOptions, props.weightDir]);

  return (
    <div>
      {error && (
        <p className="text-red-500 font-bold">
          Error detected! Please check the logs. Let me know choltz@hey.com if
          it's unclear.
        </p>
      )}
      {showOptions ? (
        <form
          id="options-form"
          className="z-20 mt-4 space-y-4 bg-gray-50 shadow-xl border border-gray-100 p-4 rounded-lg"
          onSubmit={handleOptionsSubmit}
        >
          <h1 className="font-bold text-gray-800 font-mono">CHARL-E Options</h1>
          <div>
            <label
              htmlFor="outdir"
              className="block text-sm font-medium text-gray-700"
            >
              Where should we save your images?
            </label>
            <div className="mt-1">
              <input
                type="text"
                name="--outdir"
                id="outdir"
                value={outDir}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                onChange={(e) => setOutDir(e.target.value)}
                placeholder={outDir}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="--ddim_steps"
              className="block text-sm font-medium text-gray-700"
            >
              DDIM sampling steps. This will make the biggest difference to the
              quality of your image, but takes time. I recommend 25-50.
            </label>
            <input
              id="--ddim_steps"
              type="number"
              name="--ddim_steps"
              placeholder="ddim_steps"
              value={ddimSteps}
              onChange={(e) => setDdimSteps(e.target.value)}
              className="block w-24 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="--n_samples"
              className="block text-sm font-medium text-gray-700"
            >
              How many images should I produce for each given prompt?
            </label>
            <input
              id="--n_samples"
              type="number"
              name="--n_samples"
              placeholder="n_samples"
              value={numSamples}
              onChange={(e) => setNumSamples(e.target.value)}
              className="block w-24 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="--n_samples"
              className="block text-sm font-medium text-gray-700"
            >
              PLMS sampling? These have a little more dreamlike / abstract vibe.
            </label>
            <input
              id="--plms"
              type="checkbox"
              name="--plms"
              placeholder="--plms"
              checked={plms === 'on'}
              onChange={() => setPlms(plms === 'on' ? 'off' : 'on')}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="outdir"
              className="block text-sm font-medium text-gray-700"
            >
              Seed number?
            </label>
            <div className="mt-1">
              <input
                type="number"
                name="--seed"
                id="seed"
                value={seed}
                className="block w-24 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                onChange={(e) => setSeed(e.target.value)}
                placeholder={seed}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="weights"
              className="block text-sm font-medium text-gray-700"
            >
              Where are your weights stored? You can download weights{' '}
              <button
                type="button"
                onClick={() =>
                  shell.openExternal(
                    'https://huggingface.co/CompVis/stable-diffusion-v-1-4-original'
                  )
                }
                className="underline"
              >
                here
              </button>
            </label>
            <div className="mt-1">
              <input
                type="text"
                name="--ckpt"
                id="weights"
                value={weights}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                onChange={(e) => setWeights(e.target.value)}
                placeholder={weights}
              />
            </div>
          </div>
          <div className="flex">
            <button
              id="reset"
              type="button"
              onClick={reset}
              className="w-1/2 mr-2 text-center rounded-md bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 px-3 py-2 text-sm font-medium leading-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Reset
            </button>
            <button
              id="submit"
              type="submit"
              className="w-1/2 text-center rounded-md border border-transparent bg-blue-600 px-3 py-2 text-sm font-medium leading-4 text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Done{' '}
            </button>
          </div>
        </form>
      ) : (
        // PROMPT
        <div>
          <div className="relative mt-1 flex items-center">
            <form
              className="w-full inline-flex"
              onSubmit={handleSubmit}
              onChange={(e) => handlePrompt(e.target.value)}
            >
              <input
                type="text"
                name="search"
                id="search"
                placeholder="An iguana riding a surfboard on the moon by Picasso"
                className="block text-base py-2 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              {loading ? (
                <div className="flex">
                  <button
                    type="button"
                    className="ml-2 cursor-not-allowed inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    disabled
                  >
                    <svg
                      aria-hidden="true"
                      className="mr-2 w-4 h-4 text-blue-200 animate-spin fill-blue-600"
                      viewBox="0 0 100 101"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                        fill="currentColor"
                      />
                      <path
                        d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                        fill="currentFill"
                      />
                    </svg>
                    Generating...
                  </button>
                  <button
                    onClick={() => handleCancel()}
                    type="button"
                    className={`border border-gray-300 text-red-500 ml-2 inline-flex items-center rounded-md px-4 py-2 text-base font-medium shadow-sm  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="submit"
                  className={`ml-2 inline-flex items-center rounded-md ${
                    prompt === ''
                      ? 'text-gray-200 cursor-not-allowed'
                      : 'text-gray-700 background-animate hover:border hover:border-red-500 hover:text-white hover:bg-gradient-to-br hover:from-pink-600 hover:via-red-500 hover:to-orange-400'
                  } border border-gray-300 bg-white px-4 py-2 text-base font-medium shadow-sm  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                >
                  Generate
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Image() {
  const [image, setImage] = useState(
    'media-loader:///Users/charlieholtz/workspace/dev/electron-react/outputs/txt2img-samples/iguana.png'
  );
  const [confetti, setConfetti] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showProgressBar, setShowProgressBar] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [background, setBackground] = useState(' from-gray-300 gray-500');

  const viewImage = (file: string) => {
    window.electron.ipcRenderer.sendMessage('open-file', file);
  };

  window.electron.ipcRenderer.on('image-load', (file) => {
    setImage(`media-loader://${file}`);
    setConfetti(true);
    setTimeout(() => setConfetti(false), 5000);
    setLoadingStatus('Done');
    setShowProgressBar(false);
  });

  window.electron.ipcRenderer.on('initializing', (init) => {
    setLoadingStatus('Initializing...');
  });

  window.electron.ipcRenderer.on('killed', (killed) => {
    setProgress(0);
    setLoadingStatus('');
  });

  window.electron.ipcRenderer.on('loading-update', (pct) => {
    setShowProgressBar(true);
    setProgress(pct);
    setLoadingStatus('Sampling...');

    if (pct === '100') {
      setLoadingStatus('Finalizing...');
    }
  });

  return (
    <div className=" w-full">
      {confetti && <Confetti width={1000} height={1000} />}

      {/* Loading Bar */}
      {showProgressBar && (
        <>
          <div className="my-4 w-full bg-gray-200 rounded-full h-2.5 mb-4 ">
            <div
              className="bg-blue-600 h-2.5 rounded-full "
              style={{ width: `${progress}%` }}
            >
              <span className="sr-only">{progress}</span>
            </div>
          </div>
        </>
      )}

      {loadingStatus !== '' && loadingStatus !== 'Done' && (
        <div
          className={`flex items-center  mt-4 shadow-lg rounded-lg background-animate bg-gradient-to-tr ${background}`}
        >
          <div className="w-max h-96 items-center m-auto">
            <p className="font-mono mt-40 text-white font-bold rounded-lg">
              {loadingStatus}
              {progress}%
            </p>
          </div>
        </div>
      )}

      {loadingStatus === 'Framing' && (
        <p className="font-mono my-4 font-bold text-center">{loadingStatus}</p>
      )}

      {loadingStatus === 'Done' && (
        <>
          <div className="mt-8" type="button" onClick={() => viewImage(image)}>
            <img
              src={image}
              alt=""
              className="rounded-lg shadow-xl w-full hover:shadow-2xl hover:cursor-pointer"
            />
          </div>

          <p className="text-center italic text-gray-600 text-lg mt-2">
            <Sparkles>
              {image.replace('media-loader://', '').split('/').at(-1)}
            </Sparkles>
          </p>
        </>
      )}
    </div>
  );
}

const Main = () => {
  const [showLogs, setShowLogs] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [outDir, setOutDir] = useState('');
  const [weightDir, setWeightDir] = useState('');
  const [images, setImages] = useState([]);
  const [logs, setLogs] = useState([]);
  const [showGallery, setShowGallery] = useState(false);
  const [weightsExist, setWeightsExist] = useState(true);
  const [weightProgress, setWeightProgess] = useState(0);

  window.electron.ipcRenderer.on('stdout-message', (message) => {
    setLogs([message, ...logs]);
  });

  window.electron.ipcRenderer.on('no-weights', (message) => {
    setWeightsExist(false);
  });

  window.electron.ipcRenderer.on('download-progress', (progress) => {
    setWeightProgess(Math.round(progress.percent * 100).toString());
  });

  window.electron.ipcRenderer.on('download-complete', (progress) => {
    setWeightProgess(100);
    setWeightsExist(true);
  });

  const handleKeyPress = (e) => {
    if (e.key === '\\') {
      setShowLogs(!showLogs);
      setShowOptions(false);
    }

    if (e.key === '?') {
      setShowOptions(!showOptions);
      setShowLogs(false);
    }

    if (e.key === 'Escape') {
      setShowOptions(false);
      setShowLogs(false);
    }

    if (e.key === 'g' && e.metaKey) {
      setShowGallery(!showGallery);
      setShowLogs(false);
    }
  };

  useEffect(() => {
    window.electron.ipcRenderer.on('default-outdir', (paths) => {
      setOutDir(paths.outDir);
      setImages(paths.allImages.reverse());
      setWeightDir(paths.weights);
    });
  }, [outDir, images, weightDir]); // 👈️ add state variables you want to track

  const viewImage = (file: string) => {
    window.electron.ipcRenderer.sendMessage('open-file', file);
  };

  document.addEventListener('keydown', handleKeyPress);
  return (
    <div>
      <div className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-8">
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => shell.openExternal('https://www.charl-e.com')}
              className="text-xl font-bold text-gray-700 font-mono"
            >
              🖼️ CHARL-E
            </button>

            {outDir !== '' && (
              <button
                onClick={() => setShowGallery(!showGallery)}
                type="button"
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {showGallery ? 'Hide Gallery' : 'Gallery'}{' '}
                <kbd className="ml-2 text-gray-500 mx-1 flex h-5 w-8 items-center justify-center rounded border bg-white font-semibold sm:mx-2">
                  <span className="text-sm">⌘ </span> G
                </kbd>
              </button>
            )}
          </div>
        </div>

        <div className="mx-auto">
          {/* Gallery */}
          {showGallery && (
            <div className="text-center">
              <h5 className="text-2xl text-gray-700 font-bold">
                CHARL-E Gallery
              </h5>
              <p className="text-xs text-gray-500">
                Want to see other creations and get some prompt inspiration?
                Check out{' '}
                <button
                  type="button"
                  className="font-bold"
                  onClick={() => shell.openExternal('https://lexica.art')}
                >
                  Lexica.art
                </button>
              </p>
              <div className="grid grid-cols-2 gap-3 my-4">
                {images.map((image, index) => (
                  <div key={index} onClick={() => viewImage(image)}>
                    <img
                      className="rounded-lg shadow-sm hover:shadow-xl hover:cursor-pointer"
                      src={`media-loader://${image}`}
                      alt=""
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={`${showGallery ? 'hidden' : ''}`}>
            {outDir !== '' && weightsExist ? (
              <Prompt
                weightDir={weightDir}
                outDir={outDir}
                showOptions={showOptions}
              />
            ) : (
              'Loading...'
            )}

            {/* Image */}
            <Image />
          </div>
        </div>

        {!weightsExist && (
          <div className="text-center mt-4">
            <p className="font-bold">Downloading weights...{weightProgress}%</p>
            <>
              <div className="my-4 w-full bg-gray-200 rounded-full h-2.5 mb-4 ">
                <div
                  className="bg-blue-600 h-2.5 rounded-full "
                  style={{ width: `${weightProgress}%` }}
                >
                  <span className="sr-only">${weightProgress}</span>
                </div>
              </div>
            </>
          </div>
        )}

        {/* Show Logs Button */}
        <div className="z-10 fixed bottom-4 right-4">
          <button
            onClick={() => setShowLogs(!showLogs)}
            type="button"
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Logs{' '}
            <kbd className="ml-2 text-gray-500 mx-1 flex h-5 w-5 items-center justify-center rounded border bg-white font-semibold sm:mx-2">
              \
            </kbd>
          </button>
        </div>

        <div className="z-10 fixed bottom-4 left-4">
          <button
            onClick={() => setShowOptions(!showOptions)}
            type="button"
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Options{' '}
            <kbd className="ml-2 text-gray-500 mx-1 flex h-5 w-5 items-center justify-center rounded border bg-white font-semibold sm:mx-2">
              ?
            </kbd>
          </button>
        </div>
      </div>

      {showLogs && (
        <div className="bg-gray-800 font-mono text-green-200 px-4 py-2 rounded-lg overflow-x-scroll w-full fixed bottom-0 -mb-4 h-1/2 z-0">
          <div className="text-green-300 flex justify-between">
            <p>CHARL-E</p>

            <p className="animate-pulse">{new Date().toLocaleTimeString()}</p>
          </div>
          <ul className="">
            {logs.map((log, index) => (
              <li key={index}>{log}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Main />} />
      </Routes>
    </Router>
  );
}
