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


#include "talk/examples/peerconnection/client/mac/main_wnd.h"

#include <stddef.h>

#define LOGGING 1


#include "talk/examples/peerconnection/client/defaults.h"
#include "talk/base/common.h"
#include "talk/base/logging.h"
#include "talk/base/stringutils.h"

using talk_base::sprintfn;

//
// MacMainWnd implementation.
//

MacMainWnd::MacMainWnd(const char* server, int port, bool autoconnect,
                       bool autocall)
    : window_(NULL), server_edit_(NULL),
      port_edit_(NULL), peer_list_(NULL), callback_(NULL),
      server_(server), autoconnect_(autoconnect), autocall_(autocall) {
  char buffer[10];
  sprintfn(buffer, sizeof(buffer), "%i", port);
  if (autoconnect) {
    printf("autoconnect true\n");
  }
  port_ = buffer;
}

MacMainWnd::~MacMainWnd() {
  ASSERT(!IsWindow());
}

void MacMainWnd::RegisterObserver(MainWndCallback* callback) {
  LOG(INFO) << "******** LOGGING WORKS";
  callback_ = callback;

  server_ = "127.0.0.1";
  port_ = "8888";
  int port = port_.length() ? atoi(port_.c_str()) : 0;
  callback_->StartLogin(server_, port);


}

bool MacMainWnd::IsWindow() {
  return true;
}


void MacMainWnd::MessageBox(const char* caption, const char* text,
                            bool is_error) {

  printf("Message Box caption: %s \nText: %s\n",caption,text);
}

MainWindow::UI MacMainWnd::current_ui() {
  if (vbox_)
    return CONNECT_TO_SERVER;

  if (peer_list_)
    return LIST_PEERS;

  return STREAMING;
}


// TODO: move this to an audio rendedrer
void MacMainWnd::StartLocalRenderer(webrtc::VideoTrackInterface* local_audio) {
  printf("Start Local renderer (audio)");
  local_renderer_.reset(new VideoRenderer(this, local_audio));
}

void MacMainWnd::StopLocalRenderer() {
  printf("Stop Local renderer");
  local_renderer_.reset();
}

void MacMainWnd::StartRemoteRenderer(webrtc::VideoTrackInterface* remote_audio) {
  printf("Start Remote renderer");
  remote_renderer_.reset(new VideoRenderer(this, remote_audio));
}

void MacMainWnd::StopRemoteRenderer() {
  printf("Stop Remote renderer");
  remote_renderer_.reset();
}

void MacMainWnd::QueueUIThreadCallback(int msg_id, void* data) {

  callback_->UIThreadCallback(msg_id, data);

}

bool MacMainWnd::Create() {
   LOG(INFO) << "Create main window.";
   printf("Create main window - does not do anything\n");
   SwitchToConnectUI();
   return true;
}

bool MacMainWnd::Destroy() {
   LOG(INFO) << "Destroy main window.";
   printf("Destroy main window\n");
  if (!IsWindow())
    return false;

  window_ = NULL;

  return true;
}

void MacMainWnd::SwitchToConnectUI() {
  LOG(INFO) << __FUNCTION__;

  ASSERT(IsWindow());
  ASSERT(vbox_ == NULL);

}

void MacMainWnd::SwitchToPeerList(const Peers& peers) {
  int id = -1;
  LOG(INFO) << __FUNCTION__;
  LOG(INFO) << "Gotta do something with those peers";
  for (Peers::const_iterator i = peers.begin(); i != peers.end(); ++i) {
      LOG(INFO) << "Peer: " << i->second.c_str() << " - " << i->first;
      id = i->first;
  }

  //if (autocall_ && peers.begin() != peers.end())
  //  g_idle_add(SimulateLastRowActivated, peer_list_);
  if (id != -1)
       callback_->ConnectToPeer(id);

}

void MacMainWnd::SwitchToStreamingUI() {
  LOG(INFO) << __FUNCTION__;

}

void MacMainWnd::OnDestroyed() {
  callback_->Close();
  window_ = NULL;
  draw_area_ = NULL;
  vbox_ = NULL;
  server_edit_ = NULL;
  port_edit_ = NULL;
  peer_list_ = NULL;
}


void MacMainWnd::OnRedraw() {

}

MacMainWnd::VideoRenderer::VideoRenderer(
    MacMainWnd* main_wnd,
    webrtc::VideoTrackInterface* track_to_render)
    : width_(0),
      height_(0),
      main_wnd_(main_wnd),
      rendered_track_(track_to_render) {
  rendered_track_->AddRenderer(this);
}

MacMainWnd::VideoRenderer::~VideoRenderer() {
  rendered_track_->RemoveRenderer(this);
}

// TODO: remove this
void MacMainWnd::VideoRenderer::SetSize(int width, int height) {
}

// TODO: ok, how the hell to we use "cricket" ?
void MacMainWnd::VideoRenderer::RenderFrame(const cricket::VideoFrame* frame) {
}


