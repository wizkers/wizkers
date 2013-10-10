

window.Fluke289DiagView = Backbone.View.extend({

    initialize:function (options) {
        this.linkManager = this.options.lm;        
        
        if (this.linkManager.streaming) {
            this.linkManager.stopLiveStream();
        }
        
        this.linkManager.on('input', this.showInput, this);
        
        this.initialized = false;
    },
    
    events: {
        "click .refresh": "refresh",
        "click .disptest": "disptest",
        "click .setrtc": "setrtc",
        "click #cmdsend": "sendcmd",
        "keypress input#manualcmd": "sendcmd",
        "click #nameset": "setdevtag",
        "keypress input#devname": "setdevtag",
        "click .keyboard": "presskey",
    },
    
    onClose: function() {
        console.log("Fluke289 diag view closing...");
        this.linkManager.off('input', this.showInput, this);
    },

    render:function () {
        this.$el.html(this.template(this.model.toJSON()));
        
        this.refresh();
        return this;
    },
    
    refresh: function() {
        // Query DMM for various info:
        this.queriesDone = false;
        if (this.linkManager.connected) {
            this.linkManager.driver.getDevInfo();
            this.linkManager.driver.version();
        }
    },
    
    presskey: function(event) {
        var val = event.currentTarget.value;
        this.linkManager.driver.sendKeypress(val);
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
        
        if (data.screenshot != undefined) {
            var height = data.height;
            var width = data.width;
            var cnv = $('#screenshot')[0];
            var ctx = cnv.getContext('2d');
            ctx.canvas.width = width;
            ctx.canvas.height = height;
            var imageData = ctx.createImageData(width,height);
            
            var hexToRgb = function(hex) {
                var r = hex >> 16;
                var g = hex >> 8 & 0xff;
                var b = hex  & 0xff;
                
                // return [255,255,255,255];
                return [r,g,b];
            };
            
            // Now fill the canvas using our B&W image:
            for (var y = 0; y < height; y++) {
                for (var x = 0; x < width; x++) {
                    // Find pixel index in imageData:
                    var idx = (y * width + x) * 4;;
                    var rgba = hexToRgb(Number(data.screenshot[y][x]));
                    imageData.data[idx] = rgba[0];
                    imageData.data[idx+1] = rgba[1];
                    imageData.data[idx+2] = rgba[2];
                    imageData.data[idx+3] = 255;
                }
            }
            ctx.putImageData(imageData,0,0);
            
        } else {
        
            // Populate various fields based on what properties we receive
            for (var prop in data) {
                if ($('#'+prop, this.el)) {
                    $('#'+prop,this.el).val(data[prop]);
                    $('#'+prop,this.el).html(data[prop]);
                }
            }
        }

    }
});