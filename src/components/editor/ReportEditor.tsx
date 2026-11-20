"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import "./editor.css";
import { createReportStore, type ReportStore } from "./store";

type EditorHandle = { destroy: () => void; flush: () => Promise<void> };
declare global {
  interface Window {
    HSEditor?: { mount: (opts: { store: ReportStore; readOnly: boolean }) => EditorHandle };
  }
}

// Loaded in order: PowerPoint engine, slide backgrounds, slide model, editor UI.
const SCRIPTS = [
  "/editor/pptxgen.bundle.js",
  "/editor/assets.js",
  "/editor/core.js",
  "/editor/app.js",
];

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[data-hs="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = false;
    s.dataset.hs = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  });
}

export function ReportEditor({ reportId, canEdit }: { reportId: string; canEdit: boolean }) {
  const handle = useRef<EditorHandle | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const src of SCRIPTS) await loadScript(src);
      if (cancelled || !window.HSEditor) return;
      handle.current = window.HSEditor.mount({
        store: createReportStore(reportId),
        readOnly: !canEdit,
      });
    })().catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
      handle.current?.flush().catch(() => undefined);
      handle.current?.destroy();
      handle.current = null;
    };
  }, [reportId, canEdit]);

  return (
    <div className="hs-ed">
      {error && (
        <p role="alert" className="px-4 py-2 text-sm text-status-redorange">
          {error}
        </p>
      )}
      <div id="top">
        <Link href="/" className="back">
          ← Reports
        </Link>
        <input id="rName" aria-label="Report name" placeholder="Report name" />
        <div className="tabs" role="tablist">
          <button id="tabEd" className="on" type="button">
            Slide editor
          </button>
          <button id="tabEn" type="button">
            Page-wise entry
          </button>
        </div>
        <div className="sp" />
        <span id="saveState" aria-live="polite" />
        <button
          className="tb"
          id="bOpen"
          type="button"
          title="Replace this report with a backup file (.json)"
        >
          Import backup
        </button>
        <button
          className="tb"
          id="bSave"
          type="button"
          title="Download the whole report, images included, as .json"
        >
          Download backup
        </button>
        <button className="tb" id="bSet" type="button">
          Settings
        </button>
        <button
          className="tb"
          id="bPdf"
          type="button"
          title="Opens the print dialog – choose “Save as PDF”"
        >
          Export PDF
        </button>
        <button className="tb pri" id="bExport" type="button">
          Export PPTX
        </button>
      </div>
      <div id="main">
        <aside id="side" aria-label="Pages">
          <div className="hd">
            <input id="q" placeholder="Search pages…" aria-label="Search pages" />
          </div>
          <div className="meta" id="meta" />
          <div id="slist" />
          <div className="ft">
            <button className="btn y" id="bAddSlide" type="button" style={{ flex: 1 }}>
              + Add slide
            </button>
            <button className="btn" id="bAll" type="button" title="Include or exclude all">
              All on/off
            </button>
          </div>
        </aside>
        <section id="center">
          <div id="stageWrap">
            <div id="stageBox">
              <div id="stage" className="ed" />
            </div>
          </div>
          <div id="btmBar">
            <span className="lbl">Add to this slide</span>
            <button className="btn sm" data-add="text" type="button">
              + Text
            </button>
            <button className="btn sm" data-add="table" type="button">
              + Table
            </button>
            <button className="btn sm" data-add="chart" type="button">
              + Chart
            </button>
            <button className="btn sm" data-add="image" type="button">
              + Image
            </button>
            <button className="btn sm" data-add="kpi" type="button">
              + KPI card
            </button>
            <span className="sp" />
            <span className="lbl" id="hint">
              Click a box to edit · drag to move · corner to resize · Del removes
            </span>
          </div>
        </section>
        <aside id="panel" aria-label="Properties" />
        <section id="entry" aria-label="Page-wise entry" />
      </div>
      <div id="modal" role="dialog" aria-modal="true" aria-labelledby="mTitle">
        <div className="box">
          <div className="mh">
            <span id="mTitle" />
          </div>
          <div className="mb" id="mBody" />
          <div className="mf" id="mFoot" />
        </div>
      </div>
      <div id="toast" role="status" />
      <div id="busy">Building PowerPoint…</div>
      <input type="file" id="fileImg" accept="image/*" hidden />
      <input type="file" id="fileProj" accept=".json,application/json" hidden />
    </div>
  );
}
