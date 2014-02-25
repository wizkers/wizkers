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
    
    var kxpa100 = false; // Keep track of the presence of an amplifier


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
        // Ignore settings and use a good fixed interval, i.e. 1 second

        // The radio can do live streaming to an extent, so we definitely gotta
        // take advantage:
        this.cc('AI2;FA;FB;AG;RG;BW;');

        this.livePoller = setInterval(this.queryRadio.bind(this), 1000);
        this.streaming = true;
        return true; 
    }
        
    this.stopLiveStream = function() {
        if (!this.streaming)
            return;
        if (typeof this.livePoller != 'undefined') {
            console.log("Elecraft  - Stopping live data stream");
            // Stop live streaming from the radio:
            this.cc('AI0;');
            
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
    
    this.cc = function(d) {
        lm.socket.emit('controllerCommand',d);
    }
    
    this.screen = function(n) {
        lm.socket.emit('controllerCommand', 'S:' + n);
    }
    
    this.getRequestedPower = function() {
        this.cc('PC;');
    }
    
    this.setVFO = function(f, vfo) {
        var freq = ("00000000000" + (parseInt(f*1e6).toString())).slice(-11); // Nifty, eh ?
        if (freq.indexOf("N") > -1) { // detect "NaN" in the string
            console.log("Invalid VFO spec");
            this.cc((vfo == 'A' || vfo == 'a') ? 'FA;' : 'FB;');
        } else {
            console.log("VFO" + vfo + ": " + freq);
            this.cc(((vfo == 'A' || vfo == 'a') ? 'FA' : 'FB') + freq + ';');
        }
    }    

    this.setPower = function(p) {
        var pwr = ("000" + (parseInt(p).toString())).slice(-3); // Nifty, eh ?
        if (pwr.indexOf("N") > -1) { // detect "NaN" in the pwr
            this.cc('PC;');
        } else {
            console.log('PC' + pwr + ';');
            this.cc('PC'+ pwr + ';');
        }
    }
    
    this.setAG = function(ag) {
        var gain = ("000" + ag).slice(-3);
        this.cc('AG' + gain + ';');
    }
    
    this.setRG = function(rg) {
        // Need to translate "-60 to 0" into "190 to 250"
        this.cc('RG' + (rg+250) + ';');
    }
    
    this.setBW = function(bw) { // Bandwidth in kHz (0 to 4.0)
        var bandwidth = ("0000" + Math.floor(bw*100)).slice(-4);
        this.cc('BW' + bandwidth + ';');
    }

    this.queryRadio = function() {
        
        // This is queried every 2 seconds - we stage our queries in order
        // to avoid overloading the radio, not sure that is totally necessary, but
        // this won't hurt
        
        // Query displays
        this.cc('DB;DS;'); // Query VFO B and VFOA Display
        
        // Then ask the radio for current figures:
        this.cc('PO;'); // Query actual power output
        
        // And if we have an amp, then we can get a lot more data:
        this.cc('^PI;^PF;^PV;^TM;');
    }

    
    
    
    console.log('Started Elecraft link manager driver..');

}

