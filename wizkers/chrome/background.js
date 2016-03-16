chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('www/chrome.html', {
    'bounds': {
      'width': 1280,
      'height': 800
    }
  });
});
