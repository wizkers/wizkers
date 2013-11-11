// The main screen of our app.
// 
// Our model is the settings object.

window.FCOledNumView = Backbone.View.extend({

    initialize:function (options) {
        this.settings = this.model;
        
        this.sessionStartStamp = new Date().getTime();
        this.maxreading = 0;
        this.minreading = -1;

        
        linkManager.on('input', this.showInput, this);

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
        linkManager.off('input', this.showInput,this);
    },
    
    showInput: function(data) {
        if (typeof(data.v) == 'undefined')
            return;
        var v = parseFloat(data.v.avg);
        var a = parseFloat(data.a.avg);
        $('#livev', this.el).html(v.toFixed(3) + "&nbsp;V");
        $('#livea', this.el).html(a.toFixed(3) + "&nbsp;mA");

        // Update statistics:
        var sessionDuration = (new Date().getTime() - this.sessionStartStamp)/1000;
        $('#sessionlength',this.el).html(utils.hms(sessionDuration));

    },

    
});
