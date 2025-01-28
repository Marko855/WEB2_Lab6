let mediaRecorder;
let recordedChunks = [];
const videoPlayer = document.getElementById('videoPlayer');
const recordButton = document.getElementById('recordButton');
const stopButton = document.getElementById('stopButton');
const statusMessage = document.getElementById('statusMessage');
const galleryContainer = document.getElementById('galleryContainer');

recordButton.addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoPlayer.srcObject = stream;

    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = event => recordedChunks.push(event.data);
    mediaRecorder.onstop = saveVideo;

    mediaRecorder.start();
    recordButton.disabled = true;
    stopButton.disabled = false;
    statusMessage.textContent = "Recording...";
  } catch (error) {
    statusMessage.textContent = `Error: ${error.message}`;
  }
});

stopButton.addEventListener('click', () => {
  mediaRecorder.stop();
  videoPlayer.srcObject.getTracks().forEach(track => track.stop());
  recordButton.disabled = false;
  stopButton.disabled = true;
  statusMessage.textContent = "Recording stopped.";
});

function saveVideo() {
  const videoBlob = new Blob(recordedChunks, { type: 'video/webm' });
  const videoUrl = URL.createObjectURL(videoBlob);

  createVideoCard(videoUrl, videoBlob);

  recordedChunks = [];
  incrementVideoCounter();

  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.sync.register('counter-sync')
        .then(() => {
          console.log('Background sync registered for counter updates!');
        })
        .catch((err) => {
          console.log('Background sync failed for counter:', err);
        });
    });
  }
  

  showNotification("Your video has been saved!");
}

function createVideoCard(videoUrl, videoBlob) {
  const card = document.createElement('div');
  card.className = 'video-card';

  const videoElement = document.createElement('video');
  videoElement.src = videoUrl;
  videoElement.controls = true;

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Enter video name';

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'actions';

  const downloadButton = document.createElement('button');
  downloadButton.className = 'download-button';
  downloadButton.textContent = 'Download';
  downloadButton.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = nameInput.value || 'video.webm';
    a.click();
  });

  const deleteButton = document.createElement('button');
  deleteButton.className = 'delete-button';
  deleteButton.textContent = 'Delete';
  deleteButton.addEventListener('click', () => {
    galleryContainer.removeChild(card);
  });

  actionsDiv.appendChild(downloadButton);
  actionsDiv.appendChild(deleteButton);

  card.appendChild(videoElement);
  card.appendChild(nameInput);
  card.appendChild(actionsDiv);

  galleryContainer.appendChild(card);
}

function showNotification(message) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Video Recorder', {
      body: message,
      icon: '/assets/icons/icon-512x512.png',
    });
  } else if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
    .then((registration) => {
      console.log('Service Worker registered with scope:', registration.scope);
    })
    .catch((error) => {
      console.log('Service Worker registration failed:', error);
    });
}

let videoCounter = 0;

function updateVideoCount() {
  const videoCountElement = document.getElementById('videoCount');
  videoCountElement.textContent = videoCounter;
}

function incrementVideoCounter() {
  videoCounter++;
  updateVideoCount();
  saveCounterToIndexedDB(videoCounter);
  registerSyncEvent(); 
}

function loadCounterFromIndexedDB() {
  const request = indexedDB.open('videoRecorderDB', 1);

  request.onupgradeneeded = (event) => {
    const db = event.target.result;
    if (!db.objectStoreNames.contains('counters')) {
      const store = db.createObjectStore('counters', { keyPath: 'id' });
      store.createIndex('id', 'id', { unique: true }); 
    }
  };

  request.onsuccess = (event) => {
    const db = event.target.result;

    if (db.objectStoreNames.contains('counters')) {
      const transaction = db.transaction('counters', 'readonly');
      const store = transaction.objectStore('counters');
      const getRequest = store.get('videoCounter');

      getRequest.onsuccess = () => {
        if (getRequest.result) {
          videoCounter = getRequest.result.count;
        } else {
          videoCounter = 0;
          saveCounterToIndexedDB(videoCounter);
        }
        updateVideoCount(); 
      };

      getRequest.onerror = () => {
        console.error('Failed to load counter from IndexedDB');
      };
    } else {
      console.error('The "counters" object store is missing.');
    }
  };

  request.onerror = () => {
    console.error('Failed to open IndexedDB');
  };
}

function saveCounterToIndexedDB(counter) {
  if (!('indexedDB' in window)) {
    console.error('This browser does not support IndexedDB.');
    return;
  }

  const request = indexedDB.open('videoRecorderDB', 1);

  request.onupgradeneeded = (event) => {
    const db = event.target.result;
    if (!db.objectStoreNames.contains('counters')) {
      const store = db.createObjectStore('counters', { keyPath: 'id' });
      store.createIndex('id', 'id', { unique: true }); 
    }
  };

  request.onsuccess = (event) => {
    const db = event.target.result;
    const transaction = db.transaction('counters', 'readwrite');
    const store = transaction.objectStore('counters');
    store.put({ id: 'videoCounter', count: counter });
  };

  request.onerror = (event) => {
    console.error('Error opening IndexedDB:', event.target.errorCode);
  };
}

loadCounterFromIndexedDB();

function registerSyncEvent() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then((swRegistration) => {
      return swRegistration.sync.register('counter-sync');
    }).then(() => {
      console.log('Counter sync event registered.');
    }).catch((error) => {
      console.error('Failed to register counter sync event:', error);
    });
  }
}
