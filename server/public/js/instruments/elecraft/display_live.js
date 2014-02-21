/**
 *  Elecraft Live Display view
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
            
            // Ask the radio for a few additional things:
            // Requested power:
            linkManager.driver.getRequestedPower();
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
        var val = data.substr(2);
        if (cmd == "DB") {
            // VFO B Text
            $("#kx3 #VFOB").html(val + " ");
        } else if (cmd == "DS") {
            // VFO A Text, a bit more tricky:
            if (val.length < 8) {
                console.log("Error: VFO A buffer too short!");
                return;
            }
            var txt = "";
            for (var i=0; i < 8; i++) {
                if (val.charCodeAt(i) & 0x80) // Dot on the left side of the character
                    txt += ".";
                var val2 = val.charCodeAt(i) & 0x7F;
                // Do replacements:
                if (val2 == 0x40)
                        val2 = 0x20;
                txt += String.fromCharCode(val2);
            }
            $("#kx3 #VFOA").html(txt);
        } else if (cmd == "PC") {
            $("#Power-Direct").val(parseInt(val));
        } else if (cmd == "FA") {
            $("#VFOA-Direct").val(parseInt(val)/1e6);
        } else if (cmd == "FB") {
            $("#VFOB-Direct").val(parseInt(val)/1e6);
        }    

    },

});
