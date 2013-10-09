// The main screen of our app.
// 
// Our model is the settings object.

window.Fluke289NumView = Backbone.View.extend({

    initialize:function (options) {
        this.linkManager = this.options.lm;
        this.settings = this.model;
        
        this.sessionStartStamp = new Date().getTime();

        this.linkManager.on('input', this.showInput, this);
    },
    
    events: {
    },
    
    render:function () {
        var self = this;
        console.log('Main render of FLuke289 numeric view');
        $(this.el).html(this.template());
        return this;
    },
        
    onClose: function() {
        console.log("Fluke289 numeric view closing...");
        this.linkManager.off('input', this.showInput, this);
    },
    
    showInput: function(data) {
        if (typeof(data.value) == 'undefined')
            return;
        
        $('#livereading', this.el).html(data.value + "&nbsp;" + this.linkManager.driver.mapUnit(data.unit));

        // Update statistics:
        var sessionDuration = (new Date().getTime() - this.sessionStartStamp)/1000;
        $('#sessionlength',this.el).html(utils.hms(sessionDuration));

    },

    
});
