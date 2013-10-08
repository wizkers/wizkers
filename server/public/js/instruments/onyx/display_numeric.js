// The main screen of our app.
// 
// Our model is the settings object.

window.OnyxNumView = Backbone.View.extend({

    initialize:function (options) {
        this.linkManager = this.options.lm;
        this.settings = this.model;
        
        this.sessionStartStamp = new Date().getTime();
        this.maxreading = 0;
        this.minreading = -1;

        
        this.linkManager.on('input', this.showInput, this);

    },
    
    events: {
    },
    
    render:function () {
        var self = this;
        console.log('Main render of Onyx numeric view');
        $(this.el).html(this.template());
        return this;
    },
        
    onClose: function() {
        console.log("Onyx numeric view closing...");
        this.linkManager.off('input', this.showInput);
    },
    
    showInput: function(data) {
        if (typeof(data.cpm) == 'undefined')
            return;
        var cpm = parseFloat(data.cpm.value);
        $('#livecpm', this.el).html(cpm.toFixed(3) + "&nbsp;CPM");
        $('#liveusvh', this.el).html((cpm*0.00294).toFixed(3) + "&nbsp;&mu;Sv/h");

        // Update statistics:
        var sessionDuration = (new Date().getTime() - this.sessionStartStamp)/1000;
        $('#sessionlength',this.el).html(utils.hms(sessionDuration));
        
        if (cpm > this.maxreading) {
            this.maxreading = cpm;
            $('#maxreading', this.el).html(cpm);
        }
        if (cpm < this.minreading || this.minreading == -1) {
            this.minreading = cpm;
            $('#minreading', this.el).html(cpm);
        }

    },

    
});
