/**
 *  
 */

window.ElecraftLiveView = Backbone.View.extend({

    initialize:function () {
        this.deviceinitdone = false;

        //this.render();
        //_.bindAll(this,"handleKX3Button");
        
        linkManager.on('status', this.updateStatus, this);
        linkManager.on('input', this.showInput, this);

    },

    render:function () {
        var self = this;
        $(this.el).html(this.template());
        var s = Snap("#kx3");
        Snap.load("img/KX3.svg", function (f) {
                f.select("#layer1").click(function (e) {
                    self.handleKX3Button(e);
                });
            // Initialize icon display:
            f.select(".icon").attr({ visibility: 'hidden' });
                s.add(f);
                // Set display constraints for the radio face:
                s.attr({
                    width: "100%",
                    height: 350
                });
        });
        return this;
    },
    
    onClose: function() {
        linkManager.on('status', this.updatestatus, this);
        linkManager.off('input', this.showInput, this);
        console.log("Elecraft live view closing...");        
    },
    
    events: {
       "click #cmdsend": "sendcmd",
        "keypress input#manualcmd": "sendcmd",
    },

    handleKX3Button: function(e) {
        console.log(e.target.id);
        $("#kx3 #filter-II").css("visibility", "visible");
        $("#kx3 #VFOB").html("W6ELA");
        $("#kx3 #VFOA").html("14.780.872");
        linkManager.manualCommand("IF;");
    },
    
    sendcmd: function(event) {
        // We react both to button press & Enter key press
        if ((event.target.id == "manualcmd" && event.keyCode==13) || (event.target.id != "manualcmd"))
            linkManager.manualCommand($('#manualcmd',this.el).val());
    },
    
    updateStatus: function() {
        if (linkManager.connected && !this.deviceinitdone) {
            linkManager.startLiveStream();
        } else {
            this.deviceinitdone = false;
        }
    },


    showInput: function(data) {
        // Update our raw data monitor
        var i = $('#input',this.el);
        var scroll = (i.val() + JSON.stringify(data) + '\n').split('\n');
        // Keep max 50 lines:
        if (scroll.length > 50) {
            scroll = scroll.slice(scroll.length-50);
        }
        i.val(scroll.join('\n'));
        // Autoscroll:
        i.scrollTop(i[0].scrollHeight - i.height());
        
        // Now update our display depending on the data we received:
        var cmd = data.substr(0,2);
        if (cmd == "DB") {
            // VFO B Text
            $("#kx3 #VFOB").html(data.substr(2));
        } else if (cmd == "DS") {
            
        }

    },

});
