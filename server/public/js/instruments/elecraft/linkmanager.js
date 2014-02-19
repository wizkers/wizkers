/**
 * The controller communication manager:
 *  - manages the socket.io link
 *  - provides API to the backend device to use by views
 *
 */


// linkManager is a reference to the parent link manager
var ElecraftLinkManager = function(linkManager) {

    var self = this;
    var lm = linkManager;
    var streaming = false;
    var livePoller = null; // Reference to the timer for live streaming



    //////
    //  Standard API:
    // All link managers need this function:
    //////
    this.setBackendDriver = function() {
        lm.socket.emit('driver','elecraft');
    }

    // LiveStream polls the radio every 2 seconds for VFOA and VFOB data
    this.startLiveStream = function() {
        console.log("Starting live data stream for Elecraft");
        // Ignore settings and use a good fixed interval
        this.livePoller = setInterval(this.queryRadio, 2000);
        this.streaming = true;
        return true; 
    }
        
    this.stopLiveStream = function() {
        if (typeof this.livePoller != 'undefined') {
            console.log("Elecraft  - Stopping live data stream");
            clearInterval(this.livePoller);
            this.streaming = false;
        }
        return true;
    }
    
    
    //////
    // End of standard API
    //////
    
    // All commands below are fully free and depend on
    // the instrument's capabilities
    
    this.screen = function(n) {
        lm.socket.emit('controllerCommand', 'S:' + n);
    }
    
    this.queryRadio = function() {
        lm.socket.emit('controllerCommand', 'DB;');
    }

    
    
    
    console.log('Started Elecraft link manager driver..');

}

