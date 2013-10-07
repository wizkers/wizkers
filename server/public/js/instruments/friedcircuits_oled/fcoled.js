/**
 * A FriedCirctuits OLED Backpack instrument
 */


var FCOledInstrument = function() {
    
    // This has to be a backbone view
    this.getSettings = function(arg) {
        return new FCOledSettings(arg);
    };
    
    // This has to be a Backbone view
    // This is the full screen live view (not a small widget)
    this.getLiveDisplay = function(arg) {
        return new FCOledLiveView(arg);
    };
    
    // A smaller widget (just a graph)
    this.getLiveWidget = function(arg) {
        return new FCOledLiveWidget(arg);
    };
    
    // This has to be a link manager
    this.getLinkManager = function(arg) {
        return new FCOledLinkManager(arg);
    };
    
    
};