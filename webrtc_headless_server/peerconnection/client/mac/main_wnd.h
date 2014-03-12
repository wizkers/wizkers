/*
 * libjingle
 * Copyright 2012, Google Inc.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 *  1. Redistributions of source code must retain the above copyright notice,
 *     this list of conditions and the following disclaimer.
 *  2. Redistributions in binary form must reproduce the above copyright notice,
 *     this list of conditions and the following disclaimer in the documentation
 *     and/or other materials provided with the distribution.
 *  3. The name of the author may not be used to endorse or promote products
 *     derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS OR IMPLIED
 * WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO
 * EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
 * OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
 * ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */


#ifndef PEERCONNECTION_SAMPLES_CLIENT_LINUX_MAIN_WND_H_
#define PEERCONNECTION_SAMPLES_CLIENT_LINUX_MAIN_WND_H_

#include "talk/examples/peerconnection/client/main_wnd.h"
#include "talk/examples/peerconnection/client/peer_connection_client.h"

// Implements the main UI of the peer connection client.
// This is functionally equivalent to the MainWnd class in the Windows
// implementation.
class MacMainWnd : public MainWindow {
 public:
  MacMainWnd(const char* server, int port, bool autoconnect, bool autocall);
  ~MacMainWnd();

  virtual void RegisterObserver(MainWndCallback* callback);
  virtual bool IsWindow();
  virtual void SwitchToConnectUI();
  virtual void SwitchToPeerList(const Peers& peers);
  virtual void SwitchToStreamingUI();
  virtual void MessageBox(const char* caption, const char* text,
                          bool is_error);
  virtual MainWindow::UI current_ui();
  virtual void StartLocalRenderer(webrtc::VideoTrackInterface* local_video);
  virtual void StopLocalRenderer();
  virtual void StartRemoteRenderer(webrtc::VideoTrackInterface* remote_video);
  virtual void StopRemoteRenderer();

  virtual void QueueUIThreadCallback(int msg_id, void* data);

  // Creates and shows the main window with the |Connect UI| enabled.
  bool Create();

  // Destroys the window.  When the window is destroyed, it ends the
  // main message loop.
  bool Destroy();

  // Callback for when the main window is destroyed.
  void OnDestroyed();

  void OnRedraw();


 protected:
  class VideoRenderer : public webrtc::VideoRendererInterface {
   public:
    VideoRenderer(MacMainWnd* main_wnd,
                  webrtc::VideoTrackInterface* track_to_render);
    virtual ~VideoRenderer();

    // VideoRendererInterface implementation
    virtual void SetSize(int width, int height);
    virtual void RenderFrame(const cricket::VideoFrame* frame);

    const uint8* image() const {
      return image_.get();
    }

    int width() const {
      return width_;
    }

    int height() const {
      return height_;
    }

   protected:
    talk_base::scoped_ptr<uint8[]> image_;
    int width_;
    int height_;
    MacMainWnd* main_wnd_;
    talk_base::scoped_refptr<webrtc::VideoTrackInterface> rendered_track_;

  };

 protected:
  char* window_;  // Our main window.
  char* draw_area_;  // The drawing surface for rendering video streams.
  char* vbox_;  // Container for the Connect UI.
  char* server_edit_;
  char* port_edit_;
  char* peer_list_;  // The list of peers.

  MainWndCallback* callback_;
  std::string server_;
  std::string port_;
  bool autoconnect_;
  bool autocall_;
  talk_base::scoped_ptr<VideoRenderer> local_renderer_;
  talk_base::scoped_ptr<VideoRenderer> remote_renderer_;
  talk_base::scoped_ptr<uint8> draw_buffer_;
  int draw_buffer_size_;
};

#endif  // PEERCONNECTION_SAMPLES_CLIENT_LINUX_MAIN_WND_H_
