import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, FileText } from "lucide-react";

const sections = [
  {
    title: "1. callEventHandler",
    badge: "Webhook / Real-Time",
    color: "bg-blue-100 text-blue-700",
    summary: "The central Telnyx webhook handler. Receives every call event from Telnyx and routes it to either the inbound IVR handler or the outbound broadcast handler based on call direction.",
    details: [
      { label: "Inbound IVR Flow", value: "Answers incoming calls → plays greeting (custom MP3 or text-to-speech) → presents menu (Press 1: listen to broadcasts, Press 2: leave a message) → plays broadcast audio playlist or records caller's voicemail → saves recording to permanent storage → creates InboundMessage record → logs a CallReport on hangup." },
      { label: "Outbound Broadcast Flow", value: "Plays audio file (or fallback TTS) to the answered recipient → hangs up after playback → on hangup: determines call status (answered/no_answer/busy/failed), updates or creates CallReport, then recalculates and updates the parent Broadcast's delivered/failed/pending counts and auto-marks it 'completed' when all calls are resolved." },
      { label: "State Management", value: "Uses base64-encoded client_state to carry context (broadcastId, callerPhone, audioUrl, step) across async Telnyx events without a database round-trip." },
    ],
  },
  {
    title: "2. sendBroadcastNotification",
    badge: "Core Broadcast Engine",
    color: "bg-purple-100 text-purple-700",
    summary: "Executes a broadcast campaign. Called when a user clicks 'Send Now' or triggered automatically by checkScheduledBroadcasts.",
    details: [
      { label: "Recipient Resolution", value: "Loads all active contacts, then filters by target groups if specified." },
      { label: "Voice Calls", value: "For each recipient, calls makeVoiceCall() which hits the Telnyx API to initiate an outbound call with the broadcast audio URL embedded in call state. Creates an initial CallReport with status 'initiated'." },
      { label: "Throttling", value: "Waits 5 seconds between each call to avoid hitting Telnyx channel limits. If a channel limit error is detected, the contact is moved to a retry queue with a 20-second wait, then retried after a 30-second cooldown." },
      { label: "Status Update", value: "Sets the broadcast status to 'in_progress' at the start of sending." },
    ],
  },
  {
    title: "3. checkScheduledBroadcasts",
    badge: "Scheduled Automation",
    color: "bg-amber-100 text-amber-700",
    summary: "Runs on a schedule (cron). Checks for any broadcasts with status 'scheduled' whose scheduled_at time has passed and triggers them automatically.",
    details: [
      { label: "Logic", value: "Queries all 'scheduled' broadcasts, filters those whose scheduled_at ≤ now, marks each as 'in_progress', then invokes sendBroadcastNotification for each one." },
      { label: "Output", value: "Returns the count of triggered broadcasts and their IDs." },
    ],
  },
  {
    title: "4. ivrInbound",
    badge: "IVR Entry Point (TeXML)",
    color: "bg-teal-100 text-teal-700",
    summary: "The TeXML-based IVR entry point — the initial webhook URL assigned to the Telnyx phone number for inbound calls. Returns XML that plays the greeting and collects a digit.",
    details: [
      { label: "Greeting", value: "Loads IvrSettings to check for a custom greeting MP3. If found, plays it; otherwise uses text-to-speech." },
      { label: "Menu", value: "Uses a <Gather> to collect 1 digit and posts it to ivrHandleMenu." },
    ],
  },
  {
    title: "5. ivrHandleMenu",
    badge: "IVR Menu Router (TeXML)",
    color: "bg-teal-100 text-teal-700",
    summary: "Receives the digit pressed by the caller and redirects to the appropriate IVR branch.",
    details: [
      { label: "Press 1", value: "Redirects to ivrPlayBroadcasts to play available broadcasts." },
      { label: "Press 2", value: "Redirects to ivrRecordMessage to let the caller record a voicemail." },
      { label: "Invalid", value: "Says 'Invalid selection. Goodbye.' and hangs up." },
    ],
  },
  {
    title: "6. ivrPlayBroadcasts",
    badge: "IVR Broadcast Playback (TeXML)",
    color: "bg-teal-100 text-teal-700",
    summary: "Handles paginated playback of all completed broadcasts from the past year via phone. Caller can navigate forward with any key or backward with #.",
    details: [
      { label: "Playlist", value: "Fetches all 'completed' broadcasts from the last year, ordered by newest first. Maps each to its audio file URL." },
      { label: "Navigation", value: "Uses an index query parameter to track position. After each broadcast, gives navigation hints and auto-advances on timeout." },
      { label: "Date Announcement", value: "Reads the broadcast date in human-readable format before playing each audio." },
    ],
  },
  {
    title: "7. ivrRecordMessage",
    badge: "IVR Recording (TeXML)",
    color: "bg-teal-100 text-teal-700",
    summary: "Handles the record-a-message flow. Plays an announcement (custom MP3 or TTS), records the caller's message, then saves it as an InboundMessage record.",
    details: [
      { label: "Announcement", value: "Plays custom record_announcement_url from IvrSettings, or falls back to TTS prompt." },
      { label: "Recording", value: "Uses <Record> with max 300 seconds and beep. On completion, posts back to itself with the recording URL." },
      { label: "Storage", value: "Saves caller phone and recording URL into the InboundMessage entity with status 'new'." },
    ],
  },
  {
    title: "8. sendDirectCalls",
    badge: "Direct Call Trigger",
    color: "bg-orange-100 text-orange-700",
    summary: "Initiates IVR calls to a specified list of contacts on demand (not tied to a broadcast). Used from the Contacts page to call selected contacts directly.",
    details: [
      { label: "Input", value: "Accepts an array of contactIds." },
      { label: "Action", value: "Looks up each contact's phone number and triggers an outbound Telnyx call pointing to the ivrInbound webhook, so the callee hears the IVR menu." },
      { label: "Output", value: "Returns counts of successful calls and errors." },
    ],
  },
  {
    title: "9. sendSms",
    badge: "SMS",
    color: "bg-green-100 text-green-700",
    summary: "Sends a single SMS message to a specified phone number via Telnyx.",
    details: [
      { label: "Input", value: "Accepts 'to' (phone number) and 'message' (text body)." },
      { label: "Action", value: "Posts to the Telnyx Messages API using the configured FROM number and messaging profile." },
      { label: "Output", value: "Returns success status and the Telnyx message ID." },
    ],
  },
  {
    title: "10. smsInbound",
    badge: "SMS Webhook",
    color: "bg-green-100 text-green-700",
    summary: "Webhook receiver for inbound SMS messages sent to the system phone number. Saves them to the InboundSms entity.",
    details: [
      { label: "Matching", value: "Attempts to match the sender's phone number to an existing Contact and saves their name." },
      { label: "Storage", value: "Creates an InboundSms record with from/to numbers, body, sender name, Telnyx message ID, and status 'new'." },
      { label: "Deduplication", value: "Stores the Telnyx message ID so the same message isn't processed twice." },
    ],
  },
  {
    title: "11. proxyRecording",
    badge: "Media Proxy",
    color: "bg-slate-100 text-slate-700",
    summary: "Acts as a secure proxy to fetch call recordings from Telnyx. Since Telnyx recording URLs require Bearer token auth, the browser can't fetch them directly.",
    details: [
      { label: "Input", value: "Accepts a recording_url in the request body." },
      { label: "Action", value: "Fetches the audio from Telnyx with the API key in the Authorization header and streams the binary response back to the client." },
      { label: "CORS", value: "Sets Access-Control-Allow-Origin: * so the browser audio player can load it." },
    ],
  },
  {
    title: "12. requestTelnyxCdrReport",
    badge: "CDR Import — Step 1",
    color: "bg-indigo-100 text-indigo-700",
    summary: "Step 1 of the 3-step Telnyx CDR import flow. Submits a request to Telnyx to generate a CSV report of call detail records for a given date range.",
    details: [
      { label: "Input", value: "Optional start_time and end_time (defaults to last 90 days)." },
      { label: "Action", value: "Calls Telnyx's legacy batch reporting API. The report is generated asynchronously by Telnyx." },
      { label: "Output", value: "Returns the report object including its ID, which is needed for step 2." },
    ],
  },
  {
    title: "13. checkTelnyxCdrStatus",
    badge: "CDR Import — Step 2",
    color: "bg-indigo-100 text-indigo-700",
    summary: "Step 2 of the CDR import flow. Polls Telnyx to check whether the requested CDR report has finished generating.",
    details: [
      { label: "Input", value: "Accepts a report_id from step 1." },
      { label: "Action", value: "Fetches the report status from Telnyx. When status is 'complete', the response includes a report_url (download link for the CSV)." },
      { label: "Output", value: "Returns the current report object; caller checks report.status and report_url." },
    ],
  },
  {
    title: "14. importTelnyxCdrData",
    badge: "CDR Import — Step 3",
    color: "bg-indigo-100 text-indigo-700",
    summary: "Step 3 of the CDR import flow. Downloads the completed CSV report and imports inbound call records into the InboundMessage entity.",
    details: [
      { label: "Input", value: "Accepts the report_url from step 2." },
      { label: "Parsing", value: "Downloads and parses the CSV, mapping columns like calling_number, duration, start_time, hangup_cause." },
      { label: "Filtering", value: "Skips outbound call records. Only imports inbound calls." },
      { label: "Deduplication", value: "Checks existing InboundMessage records by telnyx_call_control_id to skip already-imported entries." },
      { label: "Outcome Mapping", value: "Infers call_outcome from duration: ≥30s = 'listened_to_broadcasts', 5–29s = 'no_selection', <5s = 'hung_up_early'." },
    ],
  },
  {
    title: "15. importTelnyxCallHistory",
    badge: "Recording Import",
    color: "bg-indigo-100 text-indigo-700",
    summary: "Alternative import method: directly fetches Telnyx recording metadata (up to 250 records) and imports them as InboundMessage records — no CDR report needed.",
    details: [
      { label: "Action", value: "Calls the Telnyx Recordings API filtered to the system phone number." },
      { label: "Deduplication", value: "Skips any record whose call_control_id already exists in InboundMessage." },
      { label: "Data", value: "Saves caller phone, duration, recording URL, called_at, and inferred call_outcome." },
    ],
  },
  {
    title: "16. testTelnyxCall",
    badge: "Developer / Debug",
    color: "bg-red-100 text-red-700",
    summary: "A simple diagnostic function for developers to verify Telnyx credentials and place a raw test call to a specified number.",
    details: [
      { label: "Input", value: "Accepts a 'to' phone number." },
      { label: "Env Check", value: "Logs whether TELNYX_API_KEY, TELNYX_FROM_NUMBER, and TELNYX_CONNECTION_ID are set." },
      { label: "Action", value: "Places a bare Telnyx call (no IVR, no audio) to the target number. Used for connection testing only." },
    ],
  },
];

export default function AppFunctionsDoc() {
  const printRef = useRef(null);

  const handleDownload = () => {
    const html = `
      <html>
      <head>
        <meta charset="UTF-8">
        <title>VoiceCast - Backend Functions Documentation</title>
        <style>
          body { font-family: Calibri, Arial, sans-serif; margin: 40px; color: #111; font-size: 11pt; }
          h1 { font-size: 20pt; color: #1e1b4b; margin-bottom: 4px; }
          .subtitle { color: #6b7280; font-size: 10pt; margin-bottom: 30px; }
          .section { margin-bottom: 28px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 20px; page-break-inside: avoid; }
          .section-title { font-size: 13pt; font-weight: bold; color: #1e1b4b; margin: 0 0 4px 0; }
          .badge { display: inline-block; background: #ede9fe; color: #5b21b6; border-radius: 4px; padding: 2px 8px; font-size: 9pt; font-weight: 600; margin-bottom: 8px; }
          .summary { color: #374151; margin-bottom: 10px; font-size: 10.5pt; }
          table { width: 100%; border-collapse: collapse; margin-top: 6px; }
          th { text-align: left; background: #f3f4f6; padding: 6px 10px; font-size: 9.5pt; color: #374151; border: 1px solid #e5e7eb; }
          td { padding: 6px 10px; font-size: 9.5pt; border: 1px solid #e5e7eb; vertical-align: top; }
          td:first-child { font-weight: bold; color: #4b5563; width: 28%; }
          .footer { margin-top: 40px; color: #9ca3af; font-size: 9pt; text-align: center; }
        </style>
      </head>
      <body>
        <h1>VoiceCast — Backend Functions Documentation</h1>
        <p class="subtitle">Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} &nbsp;|&nbsp; Total Functions: ${sections.length}</p>
        ${sections.map(s => `
          <div class="section">
            <p class="section-title">${s.title}</p>
            <span class="badge">${s.badge}</span>
            <p class="summary">${s.summary}</p>
            <table>
              <tr><th>Aspect</th><th>Details</th></tr>
              ${s.details.map(d => `<tr><td>${d.label}</td><td>${d.value}</td></tr>`).join("")}
            </table>
          </div>
        `).join("")}
        <p class="footer">VoiceCast Broadcast System &nbsp;|&nbsp; Confidential</p>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "VoiceCast_Functions_Documentation.doc";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Backend Functions Documentation
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            All {sections.length} backend functions — what they do, how they work, and when they run.
          </p>
        </div>
        <Button onClick={handleDownload} className="gap-2 shrink-0">
          <Download className="h-4 w-4" />
          Download as Word Doc
        </Button>
      </div>

      <div ref={printRef} className="space-y-4">
        {sections.map((s) => (
          <Card key={s.title}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <CardTitle className="text-base">{s.title}</CardTitle>
                <Badge className={s.color + " text-xs font-medium"}>{s.badge}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{s.summary}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {s.details.map((d) => (
                  <div key={d.label} className="grid grid-cols-[180px_1fr] gap-3 text-sm border-t border-border pt-2 first:border-0 first:pt-0">
                    <span className="font-medium text-foreground">{d.label}</span>
                    <span className="text-muted-foreground">{d.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}