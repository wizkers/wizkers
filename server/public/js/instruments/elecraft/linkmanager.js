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
        // K31 enables extended values such as proper BPF reporting
        // AI2 does not send an initial report, so we ask for the initial data
        // before...
        this.cc('K31;IF;FA;FB;RG;FW;MG;IS;BN;MD;AI2;');

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
    
    this.getMode = function() {
        this.cc('MD;');
    }
    
    this.setMode = function(code) {
        this.cc('MD' + code + ';');
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
        this.cc('BN;'); // Refresh band number (radio does not send it automatically)
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

    this.setMG = function(mg) {
        var gain = ("000" + mg).slice(-3);
        this.cc('MG' + gain + ';');
    }

    this.setRG = function(rg) {
        // Need to translate "-60 to 0" into "190 to 250"
        this.cc('RG' + (rg+250) + ';');
    }
    
    this.setBW = function(bw) { // Bandwidth in kHz (0 to 4.0)
        var bandwidth = ("0000" + Math.floor(bw*100)).slice(-4);
        this.cc('BW' + bandwidth + ';');
    }

    this.setCT = function(ct) { // Center frequency
        var center = ("0000" + Math.floor(ct*1000)).slice(-4);
        this.cc('IS ' + center + ';'); // Note the space!
    }
    
    this.setBand = function(band) {
        // We use a band number in meters (with a "m"), this function translates into the KX3 values:
        var bands= { "160m":"00", "80m":"01", "60m":"02", "40m":"03", "30m":"04", "20m":"05", "17m":"06", "15m":"07", "12m":"08", "10m":"09", "6m":"10" };
        var bandcode = bands[band];
        if (typeof(bandcode) != 'undefined') {
            this.cc('BN' + bandcode + ';');
        }
    }

    this.queryRadio = function() {
        
        // TODO: follow radio state over here, so that we only query power
        // when the radio transmits, makes much more sense
        
        // This is queried every second - we stage our queries in order
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

