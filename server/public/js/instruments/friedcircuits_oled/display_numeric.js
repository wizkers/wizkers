// The main screen of our app.
// 
// Our model is the settings object.

window.FCOledNumView = Backbone.View.extend({

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
        console.log('Main render of FC Oled Backpack numeric view');
        $(this.el).html(this.template());
        return this;
    },
        
    onClose: function() {
        console.log("FC Oled Backpack numeric view closing...");
        this.linkManager.off('status', this.updatestatus);
        this.linkManager.off('input', this.showInput);
    },
    
    showInput: function(data) {
        if (typeof(data.v) == 'undefined')
            return;
        var v = parseFloat(data.v);
        var a = parseFloat(data.a);
        $('#livev', this.el).html(v.toFixed(3) + "&nbsp;V");
        $('#livea', this.el).html(a.toFixed(3) + "&nbsp;mA");

        // Update statistics:
        var sessionDuration = (new Date().getTime() - this.sessionStartStamp)/1000;
        $('#sessionlength',this.el).html(utils.hms(sessionDuration));

/*        
        if (cpm > this.maxreading) {
            this.maxreading = cpm;
            $('#maxreading', this.el).html(cpm);
        }
        if (cpm < this.minreading || this.minreading == -1) {
            this.minreading = cpm;
            $('#minreading', this.el).html(cpm);
        }
*/
    },

    
});
