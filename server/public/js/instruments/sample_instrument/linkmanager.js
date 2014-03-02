/**
 * The controller communication manager:
 *  - manages the socket.io link
 *  - provides API to the backend device to use by views
 *
 */


// linkManager is a reference to the parent link manager
var SampleInstrumentLinkManager = function(linkManager) {

    var self = this;
    var lm = linkManager;


    //////
    //  Standard API:
    // All link managers need this function:
    //////
    this.setBackendDriver = function() {
        lm.socket.emit('driver','w433');
    }

    // This instrument always streams its data!
    this.startLiveStream = function() {
        return true; 
    }
        
    this.stopLiveStream = function() {
        return false;
    }
    
    
    //////
    // End of standard API
    //////
    
    
    // All commands below are fully free and depend on
    // the instrument's capabilities
    
    console.log('Started Sample instrument link manager driver..');

}

