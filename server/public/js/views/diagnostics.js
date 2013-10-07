window.DiagnosticsView = Backbone.View.extend({

    initialize:function () {
        this.linkManager = this.options.lm;
        this.linkManager.on('input', this.showInput, this);
        
        if (this.linkManager.streaming) {
            this.linkManager.stopLiveStream();
        }
    },
    
    events: {
        "click .refresh": "refresh",
        "click .disptest": "disptest",
        "click .setrtc": "setrtc",
        "click #cmdsend": "sendcmd",
        "keypress input#manualcmd": "sendcmd",
        "click #nameset": "setdevtag",
        "keypress input#devname": "setdevtag",
    },
    
    onClose: function() {
        console.log("Diag view closing...");
        this.linkManager.off('input', this.showInput);
    },

    render:function () {
        var self = this;
        this.$el.html(this.template(this.model.toJSON()));
        
        this.refresh();
        return this;
    },
    
    refresh: function() {
        $('#accessorydetect',this.el).empty();
        $('#post',this.el).removeClass('badge-success').removeClass('badge-important');
        $('#post',this.el).html("Waiting...");
        $('#post2',this.el).html('');
        // Query controller for various info:
        this.queriesDone = false;
        if (this.linkManager.connected) {
            this.linkManager.controllerCommand.help();
        }
    },
    
    disptest: function() {
        this.linkManager.controllerCommand.displaytest();
    },

    setrtc: function() {
        this.linkManager.controllerCommand.settime();
    },
    
    sendcmd: function(event) {
        // We react both to button press & Enter key press
        if ((event.target.id == "manualcmd" && event.keyCode==13) || (event.target.id != "manualcmd"))
            this.linkManager.manualCommand($('#manualcmd',this.el).val());
    },

    setdevtag: function(event) {
        if ((event.target.id == "devname" && event.keyCode==13) || (event.target.id != "devname"))
            this.linkManager.controllerCommand.setdevicetag($('#devname',this.el).val());
    },

    
    showInput: function(data) {
        // Blink the indicator to show we're getting data
        $('.comlink', this.el).toggleClass('btn-success');
        var i = $('#input',this.el);
        i.val(i.val() + JSON.stringify(data) + '\n');
        // Autoscroll:
        i.scrollTop(i[0].scrollHeight - i.height());
        
        // We get the data split with "cmd" and "raw"
        if (data.cmd == "HELP") {
            this.linkManager.controllerCommand.version();            
        }
        if (data.cmd == "VERSION") {
            $('#version',this.el).html(data.raw);
            this.linkManager.controllerCommand.guid();
        }
        if (data.cmd == "GUID") {
            $('#guid',this.el).html(data.raw);
            this.linkManager.controllerCommand.devicetag();
        }
        if (data.cmd =="GETDEVICETAG") {
            var tag = data.raw.substring(data.raw.indexOf(':')+2);
            $('#devname', this.el).val(tag);
        }

    }
});