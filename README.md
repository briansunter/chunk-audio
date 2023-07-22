Chunk Audio
===========

Chunk Audio is a web-based application that leverages ffmpeg.wasm to split audio files into 10-minute chunks, and package these chunks into a downloadable ZIP file.

# Usage

Go [here](https://chunk-audio.netlify.app/) to use the app in your browser.

[Use App](https://chunk-audio.netlify.app/)

Setup
-----

**Pre-requisites**

Ensure Node.js and npm are installed on your system.

**Installation**

1. Clone the repository:

    ```
    `git clone https://github.com/briansunter/chunk-audio.git`
    ```

2. Navigate to the project directory:

    ```
    `cd chunk-audio`
    ```

3. Install the dependencies:

    ```
    `npm install`
    ```

4. Start the application:

```
`npm start`
```

Note
----

Due to the use of ffmpeg in the browser, this application can be resource-intensive, especially for large audio files.

Contributions
-------------

We welcome contributions! Fork the repository and submit a pull request to contribute. If you encounter any issues, or have feature requests or suggestions, please open an issue in the GitHub repository.

License
-------

This project is licensed under the MIT License.
