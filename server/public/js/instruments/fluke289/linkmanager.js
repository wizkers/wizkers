/**
 * The controller communication manager:
 *  - manages the socket.io link
 *  - provides API to the backend device to use by views
 *
 */


// linkManager is a reference to the parent link manager
var Fluke289LinkManager = function(linkManager) {

    var self = this;
    var lm = linkManager;
    var streaming = false;
    var livePoller = null; // Reference to the timer for live streaming


    //////
    //  Standard API:
    // All link managers need this function:
    //////
    this.setBackendDriver = function() {
        lm.socket.emit('driver','onyx');
    }

    this.startLiveStream = function() {
        console.log("Starting live data stream for Onyx");
        this.livePoller = setInterval(this.getCPM, 1000);
        this.streaming = true;

    }
    
    
    this.stopLiveStream = function() {
        if (typeof this.livePoller != 'undefined') {
            console.log("Stopping live data stream");
            clearInterval(this.livePoller);
            this.streaming = false;
        }
    }
    
    //////
    // End of standard API
    //////
    
    
    // All commands below are fully free and depend on
    // the instrument's capabilities
    
    console.log('Started Fluke289 link manager driver..');

}

