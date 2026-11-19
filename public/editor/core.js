/* ===== HydraSpecma Management Report Builder — core (templates, parsing, PPTX export) ===== */
(function (G) {
  'use strict';
  var W = 13.333, H = 7.5;
  var YEL = 'FFCD00', GREY = '595959';
  var PALETTE = ['FFCD00', '7F7F7F', '404040', 'BF9000', 'A5A5A5', 'FFE699', '262626', 'D9D9D9', 'F4B183', '9DC3E6', '2F5597', 'C9C9C9'];
  var STATUS = { G: '00B050', Y: 'FFC000', R: 'FF0000' };
  /* table cell fill markup: a cell starting with "#g ", "#y " or "#r " gets a green / yellow / red background */
  var CELL_FILL = { g: '92D050', y: 'FFE699', r: 'FF8B8B' };
  function cellFill(v) {
    var m = /^#([gyr])(?:\s+|$)/i.exec(String(v == null ? '' : v));
    return m ? { fill: CELL_FILL[m[1].toLowerCase()], text: String(v).slice(m[0].length) } : { fill: null, text: v == null ? '' : String(v) };
  }

  var _id = 0;
  function uid() { _id++; return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + _id; }

  var M12 = ['Oct-25', 'Nov-25', 'Dec-25', 'Jan-26', 'Feb-26', 'Mar-26', 'Apr-26', 'May-26', 'Jun-26', 'Jul-26', 'Aug-26', 'Sep-26'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var ACN = '# Achieved\n- \n- \n- \n# Challenge\n- \n- \n# Next Plan\n- \n- \n- ';

  function blanks(n) { var a = []; for (var i = 0; i < n; i++) a.push(''); return a; }
  /* rows from labels: '*' prefix = bold row */
  function labelRows(labels, ncols) {
    return labels.map(function (l) { return [l.replace(/^\*/, '')].concat(blanks(ncols - 1)); });
  }
  function boldFlags(labels, offset) {
    var f = [];
    for (var i = 0; i < offset; i++) f.push(false);
    labels.forEach(function (l) { f.push(/^\*/.test(l)); });
    return f;
  }
  function blankRows(n, ncols) { var r = []; for (var i = 0; i < n; i++) r.push(blanks(ncols)); return r; }

  /* ---------- block factories ---------- */
  function T(label, x, y, w, h, text, size) {
    return { id: uid(), type: 'text', label: label, x: x, y: y, w: w, h: h, text: text, size: size || 10 };
  }
  function TB(label, x, y, w, h, header, body, o) {
    o = o || {};
    var rows = header.concat(body);
    var bold = o.bold || rows.map(function () { return false; });
    return {
      id: uid(), type: 'table', label: label, x: x, y: y, w: w, h: h, caption: o.caption || '',
      rows: rows, header: header.length, rowBold: bold, size: o.size || 8,
      firstColBold: !!o.firstColBold, totalRow: !!o.totalRow, statusCol: (o.statusCol == null ? -1 : o.statusCol), colW: o.colW || ''
    };
  }
  /* labelled table: header rows + label column */
  function LT(label, x, y, w, h, header, labels, o) {
    o = o || {};
    var nc = header[header.length - 1].length;
    o.bold = boldFlags(labels, header.length);
    return TB(label, x, y, w, h, header, labelRows(labels, nc), o);
  }
  function CH(label, x, y, w, h, type, title, cats, series, o) {
    o = o || {};
    return {
      id: uid(), type: 'chart', label: label, x: x, y: y, w: w, h: h, chartType: type, title: title,
      cats: cats.slice(), series: (series || [{ name: title }]).map(function (s, i) {
        return { name: s.name, values: blanks(cats.length), kind: s.kind || 'bar', axis: s.axis || 'primary', color: s.color || PALETTE[i % PALETTE.length] };
      }),
      horizontal: !!o.horizontal, stacked: !!o.stacked, labels: o.labels !== false, legend: !!o.legend
    };
  }
  function IM(label, x, y, w, h) {
    return { id: uid(), type: 'image', label: label, x: x, y: y, w: w, h: h, src: null, iw: 0, ih: 0, fit: 'contain' };
  }
  function S(key, title, blocks, o) {
    o = o || {};
    return { id: uid(), tpl: key, layout: 'content', title: title, titleSmall: o.small || '', tag: o.tag || '', include: true, blocks: blocks || [] };
  }
  function COVER(key, subtitle, presenter, date) {
    return { id: uid(), tpl: key, layout: 'cover', title: 'HydraSpecma', subtitle: subtitle, presenter: presenter || 'Presenter name', date: date || 'Date', include: true, blocks: [] };
  }
  function END(key, text) { return { id: uid(), tpl: key, layout: 'end', title: text, include: true, blocks: [] }; }

  var FB = 'Forecast 2026 & Budget 2027';
  var PL = ['Turnover', 'Cost of goods sold', '*Contribution margin I', 'Direct wages', 'Con. mater.', 'Sales freight', '*Contribution margin II', 'Wages', 'Sales & market.', 'IT/Consult.', 'Other SG&A', '*SG&A', 'Other opr. Inc/cos.', '*EBITDA', 'Depreciations', '*EBIT', 'Profit/loss from disinvestment', 'Financial income', 'Financial costs', '*Profit before tax', 'Taxes (tax pct)', '*Profit'];
  var PLM = ['Net Sales Total', 'Total Cost of Mtrl', '*CM I', 'CM I %', 'Direct wages', 'Con. mater.', 'Sales freight', '*CM II', 'CM II %', 'Wages', 'Sales & market.', 'IT/Consult.', 'Management fees', 'Other SG&A', '*SG&A', 'Oth. opr. inc/cos.', '*EBITDA', 'EBITDA %', 'Depreciations', '*EBIT before PPA', 'EBIT before PPA %', 'PPA depreciation', '*EBIT', 'EBIT %'];

  function monthlyPL(key, title) {
    var h1 = ['', '| Budget 2027 | INRt'].concat(blanks(14)).concat(['| Actual and forecast 2026 | INRt']).concat(blanks(11));
    var h2 = [''].concat(MON).concat(['B 2027', 'FC 2026', 'AC 2025']).concat(MON);
    return S(key, title, [LT('P&L monthly table', 0.3, 1.0, 12.75, 5.9, [h1, h2], PLM, { size: 5.5 })], { tag: FB });
  }

  /* ---------- the India template (mirrors the China board report, 52 pages) ---------- */
  function TEMPLATE() {
    var supp10 = ['Supplier 1', 'Supplier 2', 'Supplier 3', 'Supplier 4', 'Supplier 5', 'Supplier 6', 'Supplier 7', 'Supplier 8', 'Supplier 9', 'Supplier 10', 'Others'];
    var yrs = ['2024', '2025', 'EST 2026'];
    var list = [
      COVER('cover', 'Renewables India Management Report', 'Presenter name', 'Date'),
      S('sales-overview', 'Sales Renewables + IAM/OEM', [
        CH('Revenue chart', 0.4, 1.0, 3.9, 2.7, 'bar', 'Revenue', ['BUD Jan-Sep', 'ACT Jan-Sep', 'BUD-2026', 'FOR-2026'], [{ name: 'Revenue' }]),
        CH('EBIT chart', 0.4, 3.75, 3.9, 2.6, 'bar', 'EBIT', ['BUD Jan-Sep', 'ACT Jan-Sep', 'BUD-2026', 'FOR-2026'], [{ name: 'EBIT' }]),
        CH('Order Intake chart', 4.5, 1.0, 4.3, 2.7, 'bar', 'Order Intake', M12, [{ name: 'Order Intake' }]),
        CH('Order Stock chart', 8.9, 1.0, 4.2, 2.7, 'bar', 'Order Stock', M12, [{ name: 'Order Stock' }]),
        IM('Image 1', 4.5, 3.9, 4.2, 2.55), IM('Image 2', 8.9, 3.9, 4.0, 2.55),
        T('Notes', 0.4, 6.4, 8.2, 0.8, '- Amounts in INR Million\n- \n- ', 9)
      ]),
      S('sales', 'Sales', [
        T('Customers (left)', 0.4, 1.05, 6.3, 5.9, '# Customer 1\n- Budget 2026: … mINR; FOI 2026: … mINR\n- \n# Customer 2\n- Budget 2026: … mINR; FOI 2026: … mINR\n- \n# Customer 3\n- \n# Customer 4\n- ', 9),
        T('Challenge / Next plan (right)', 6.9, 1.05, 6.1, 5.6, '# Challenge/Opportunity\n# Customer 1\n- \n# Customer 2\n- \n# Next Plan\n# Customer 1\n- \n# Customer 2\n- ', 9)
      ]),
      S('low-margin', 'Sales – Low Margin Items', [
        TB('Low margin items table', 0.4, 1.1, 12.5, 5.4,
          [['', '', '', 'Jan-Oct 2025', '', '', 'Jan-Oct 2026', '', '', ''], ['Item', 'Item Description', 'Type', 'Sales', 'Margin', 'CM%', 'Sales', 'Margin', 'CM%', 'Comment']],
          blankRows(10, 10).concat([['Other'].concat(blanks(9)), ['', '', 'Total'].concat(blanks(7))]), { size: 9, totalRow: true })
      ]),
      S('production', 'Production', [
        CH('Production Efficiency chart', 0.4, 1.0, 7.6, 1.95, 'bar', 'Production Efficiency', M12, [{ name: 'Efficiency' }]),
        CH('Production NCR chart', 0.4, 3.0, 7.6, 1.95, 'bar', 'Production NCR', M12, [{ name: 'NCR' }]),
        CH('Production Blue Collar chart', 0.4, 5.0, 7.6, 1.95, 'bar', 'Production Blue Collar', M12, [{ name: 'Blue Collar' }]),
        T('Achieved / Challenge / Next Plan', 8.3, 1.0, 4.7, 5.8, ACN, 10)
      ]),
      S('procurement-1', 'Procurement', [
        CH('Yearly spending chart', 0.4, 1.0, 5.6, 3.0, 'combo', 'Yearly Spending/Localization Rate mINR', yrs,
          [{ name: 'Local', kind: 'bar' }, { name: 'Oversea', kind: 'bar' }, { name: 'Local Rate', kind: 'line', axis: 'secondary' }], { legend: true }),
        CH('Top 10 oversea spending chart', 0.4, 4.1, 5.6, 2.8, 'doughnut', 'LTM Top 10 Oversea Spending mINR', supp10, [{ name: 'Spending' }], { legend: true }),
        TB('Top15 spending HS A/S', 6.2, 1.0, 6.8, 5.55, [['Item number', 'Description', 'Spending', 'Comment']], blankRows(15, 4), { size: 8, caption: 'LTM Top15 Spending on HS A/S (INR)', colW: '1.5,3,1.1,2.6' })
      ]),
      S('procurement-2', 'Procurement', [
        CH('Top 10 local spending chart', 0.4, 1.0, 6.0, 2.9, 'doughnut', 'LTM Top 10 Local Spending', supp10, [{ name: 'Spending' }]),
        CH('Procurement savings monthly chart', 0.4, 4.0, 6.0, 2.9, 'line', 'Procurement Savings (tINR)', MON,
          [{ name: 'Target Total' }, { name: 'Local+Global' }, { name: 'Local' }, { name: 'Global' }], { legend: true }),
        CH('Procurement saving yearly chart', 6.6, 1.0, 6.3, 2.4, 'bar', 'Procurement Saving 2024-2027 (mINR)', ['2024', '2025', 'FC2026', 'FC2027'], [{ name: 'Saving' }]),
        T('Achieved / Next Plan', 6.6, 3.5, 6.3, 3.4, '# Achieved\n- \n- \n- \n# Next Plan\n- \n- \n- ', 10)
      ]),
      S('supplier-matrix', 'Supplier Management Matrix – Supplier name', [
        IM('Supplier scorecard image', 0.4, 1.0, 6.0, 5.9),
        TB('KPI matrix', 6.6, 1.0, 6.4, 2.0, [['Item', 'Area', 'KPI', 'Weight', 'Jul', 'Aug', 'Sep']], [
          ['1', 'Quality', 'PPM', '15%', '', '', ''], ['', 'Quality', 'NC', '15%', '', '', ''], ['2', 'Delivery', 'OTIF (+10,-2)', '25%', '', '', ''],
          ['3', 'Service', 'On Time Response', '10%', '', '', ''], ['', 'Service', 'OC within 48 hrs', '10%', '', '', ''], ['4', 'Cost', 'Cost level within industry', '25%', '', '', ''],
          ['', '', 'Total', '100%', '', '', ''], ['', '', 'Grade', 'N/A', '', '', '']], { size: 6.5, totalRow: false, bold: [false, false, false, false, false, false, false, true, true] }),
        CH('Quality NC chart', 6.6, 3.1, 6.4, 1.3, 'bar', 'Quality NC', M12, [{ name: 'NC' }]),
        CH('Quality PPM chart', 6.6, 4.45, 6.4, 1.25, 'bar', 'Quality - PPM', M12, [{ name: 'PPM' }]),
        CH('OTIF chart', 6.6, 5.75, 6.4, 1.15, 'bar', 'OTIF', M12, [{ name: 'Site A' }, { name: 'Site B' }], { legend: true })
      ]),
      S('projects', 'Projects/Engineering', [
        TB('Projects table', 0.4, 1.0, 12.5, 5.9, [['HSIN Item Number', 'HS Description', 'Platform', 'Project Status', 'Comment']], blankRows(18, 5), { size: 7.5, colW: '2,4,2,3,4' })
      ]),
      S('qhse-1', 'QHSE', [
        CH('Safety chart', 0.4, 1.0, 6.15, 1.9, 'bar', 'Safety - Injury Lost Hour', M12, [{ name: 'Lost hour' }]),
        CH('SafetyFirst chart', 6.75, 1.0, 6.15, 1.9, 'bar', 'SafetyFirst Registration', M12, [{ name: 'Registrations' }]),
        CH('Customer claim chart', 0.4, 2.95, 6.15, 1.9, 'bar', 'Customer Claim', M12, [{ name: 'Claims' }]),
        CH('Customer claim PPM chart', 6.75, 2.95, 6.15, 1.9, 'bar', 'Customer Claim - PPM', M12, [{ name: 'PPM' }]),
        CH('Supplier NCR chart', 0.4, 4.9, 6.15, 1.9, 'bar', 'Supplier NCR', M12, [{ name: 'NCR' }]),
        CH('Supplier PPM chart', 6.75, 4.9, 6.15, 1.9, 'bar', 'Supplier PPM', M12, [{ name: 'PPM' }])
      ]),
      S('qhse-2', 'QHSE', [
        CH('LTM supplier NCRs chart', 0.4, 1.0, 7.2, 2.9, 'combo', 'LTM Supplier NCRs', supp10.slice(0, 10),
          [{ name: 'NCRs', kind: 'bar' }, { name: 'Cumulative %', kind: 'line', axis: 'secondary' }]),
        IM('Image', 0.4, 4.0, 7.2, 2.9),
        T('Achieved / Challenge / Next Plan', 7.9, 1.0, 5.1, 5.9, ACN, 10)
      ]),
      S('finance', 'Finance', [
        TB('Performance overview', 0.4, 1.0, 7.4, 1.9, [['Overall status', 'Revenue INRt', 'EBIT INRt', 'EBITDA INRt', 'ROIC incl. GW %']],
          [['Financial performance:', '', '', '', ''], ['LY / Index', '', '', '', ''], ['Index (vs. budget)', '', '', '', '']], { size: 8, caption: 'Performance Overview YTD Sep', firstColBold: true }),
        CH('Overdue payment chart', 8.0, 1.0, 5.0, 1.95, 'bar', 'Overdue Payment (tINR)', M12, [{ name: 'Overdue' }]),
        CH('NWC% chart', 0.4, 3.0, 7.4, 1.7, 'bar', 'NWC%', M12, [{ name: 'NWC%' }]),
        CH('Working capital days chart', 0.4, 4.75, 7.4, 1.65, 'bar', 'Working Capital Days', M12, [{ name: 'Days' }]),
        T('EBIT notes', 0.4, 6.4, 7.4, 0.8, '- EBIT+BSSF Actual YTD, … mINR\n- EBIT+BSSF Budget YTD, … mINR\n- Index YTD, …', 8),
        T('Achieved / Challenge / Next Plan', 8.0, 3.05, 5.0, 3.75, ACN, 9)
      ]),
      S('it', 'IT', [T('Achieved / Challenge / Next Plan', 0.4, 1.0, 12.5, 5.9, '# Achieved\n- \n- \n- \n# Challenge\n- \n-- \n-- \n- \n# Next Plan\n- \n- ', 11)]),
      S('people', 'People & Culture', [
        CH('Headcount chart', 0.4, 1.0, 7.4, 2.0, 'bar', 'Headcount', M12, [{ name: 'Blue' }, { name: 'White' }], { stacked: true, legend: true }),
        CH('Blue collar split chart', 0.4, 3.05, 7.4, 1.95, 'pie', 'Blue Collar', ['Production', 'Warehouse', 'Quality', 'Maintenance', 'Safety'], [{ name: 'Blue Collar' }]),
        CH('Employee turnover chart', 0.4, 5.05, 7.4, 1.85, 'line', 'LTM Employee Turnover', M12, [{ name: 'White' }, { name: 'Blue' }, { name: 'Total' }], { legend: true }),
        T('Achieved / Challenge / Next Plan', 8.0, 1.0, 5.0, 5.9, ACN, 10)
      ]),
      S('strategy-2026', 'Capture Future26 / Strategy', [
        T('Sub heading', 0.4, 0.95, 8, 0.45, '2026 Must Win Battles', 16),
        TB('Must win battles 2026', 0.4, 1.45, 12.5, 5.4, [['Must Win Battle', 'Lead', 'Status', 'Status comments']], blankRows(6, 4), { size: 9, statusCol: 2, colW: '4,1.2,1,7' })
      ]),
      COVER('cover-finance', 'Financial Reporting', 'Presenter name', 'Date'),
      S('monthly-report', 'Monthly Report Sep + YTD', [
        LT('P&L month', 0.3, 1.0, 6.3, 4.6, [['Profit and Loss', 'Real.', '%', 'Budget', '%', 'Dev.', '2025', '%', 'Dev.']], PL, { size: 6, caption: 'September 2026 MTH' }),
        LT('P&L YTD', 6.75, 1.0, 6.3, 4.6, [['Profit and Loss', 'Real.', '%', 'Budget', '%', 'Dev.', '2025', '%', 'Dev.']], PL, { size: 6, caption: 'September 2026 YTD' }),
        T('Comments month', 0.3, 5.75, 6.3, 1.15, '- \n- \n- ', 8),
        T('Comments YTD', 6.75, 5.75, 6.3, 1.15, '- \n- \n- ', 8)
      ]),
      (function () {
        var hdr = ['TINR', '', 'AC Jan', 'AC Feb', 'AC Mar', 'AC Apr', 'AC May', 'AC Jun', 'AC Jul', 'AC Aug', 'AC Sep', 'FC Oct', 'FC Nov', 'FC Dec', 'Y2026'];
        var rows = [], bold = [false];
        ['Turnover', 'CM1', 'CM1%', 'Other COGs', 'DIS', 'ADM', 'Stock depreciation', 'Other loss(-) or gains(+)', 'EBIT', 'BSSF-DIS', 'BSSF-ADM'].forEach(function (m) {
          ['Act/Est', 'Budget', 'Variance'].concat(m === 'EBIT' ? ['EBIT%'] : []).forEach(function (k, i) {
            rows.push([i === 0 ? m : '', k].concat(blanks(13))); bold.push(m === 'EBIT');
          });
        });
        return S('forecast-2026', 'Forecast / Budget 2026', [
          TB('Forecast table', 0.3, 1.0, 10.1, 5.9, [hdr], rows, { size: 5.5, bold: bold, firstColBold: true }),
          T('Comment', 10.55, 1.0, 2.5, 5.7, '# Comment\n- \n- \n- ', 8)
        ]);
      })(),
      COVER('cover-budget', 'Forecast 2026 & Budget 2027 presentation', 'Presenter name', 'Date'),
      S('content', 'Content', [T('Content list', 0.8, 1.2, 9, 5.6, '* Budget assumption\n* Upsides & downsides (risk factor for budget 2027)\n* Must Win battles 2027\n* Company KPI’s\n* Budget P&L YTD\n* Budget P&L MTH (Total, REN)\n* Sales – Bridge\n* EBIT - Bridge\n* CM\n* No of employees\n* CAPEX\n* Cost specification\n* Balance Sheet\n* NWC', 13)], { tag: FB }),
      S('budget-assumption', 'Budget assumption', [T('Assumptions', 0.8, 1.3, 11.8, 5.4, '# The preparation of the 2026 forecast and the 2027 budget was based on the following assumptions:\n* \n* \n* \n* ', 14)], { tag: FB }),
      S('upsides', 'Upsides & downsides', [
        T('Upsides', 1.0, 1.4, 7.4, 2.6, '#g Upsides\nv ', 14),
        T('Downsides', 1.0, 4.5, 7.4, 2.3, '#r Downsides / Risk factors\nv \nv \nv ', 14),
        IM('Image', 8.85, 3.4, 4.0, 2.5)
      ], { tag: FB, small: '(risk factor for budget 2027 & forecast F4)' }),
      (function () {
        var h1 = ['', 'Actual', 'Actual', 'Actual', 'Budget', 'R12 Aug 26', 'Forecast 3', 'Forecast 4', 'Budget', 'YTD'];
        var h2 = ['INRt', '23', '24', 'Dec 25', 'Dec 26', 'Aug 26', 'Dec 26', 'Dec 26', 'Dec 27', 'Aug 26'];
        var L = ['Acc orders received external', 'External order book', 'External Revenue', 'Internal Revenue', '*Net Sales Total', 'Total Cost of Material', '*Contribution Margin I', 'Direct wages', 'Con. mater.', 'Sales freight', '*TCMII', 'Wages', 'Sales & market.', 'IT/Consult.', 'Management fees', 'Other SG&A', '*SG&A', 'Other operating income and expenses', '*EBITDA', 'Depreciations tangible assets', 'Depreciations intangible assets', '*EBIT before PPA', 'PPA depreciation', '*EBIT', '*KEY RATIOS', 'CM I%', 'Direct wages % of revenue', 'Consumption material % of revenue (incl. prod. energy)', 'Sales freight % of revenue', 'CM II%', 'Wages % of CM II', 'IT/Consult % of CM II', 'Management fee % of revenue', 'Other SG&A % of CM II', 'Depreciation (excl PPA) in % of CM II', 'PPA depreciation in % of revenue', 'EBIT before PPA %', 'EBIT %'];
        return S('kpi-1', 'Company KPI’s', [
          LT('KPI table', 0.3, 1.0, 10.3, 5.9, [h1, h2], L, { size: 5.5, colW: '4,1,1,1,1,1,1,1,1,1' }),
          T('Comment to largest deviations', 10.75, 1.0, 2.35, 5.8, '# Comment to largest deviations:\n# CM1:\n- \n# Direct wages:\n- \n# Wages:\n- \n# Other SG&A\n- \n# Other operating income\n- ', 7)
        ], { tag: FB });
      })(),
      S('kpi-2', 'Company KPI’s', [
        LT('Employee ratios', 0.3, 1.0, 10.3, 1.45, [['KEY RATIOS EMPLOYEES', 'AC23', 'AC24', 'AC25', 'BU26', 'R12 Aug 26', 'F3PA26', 'F426', 'BU27', 'YTD Aug 26']],
          ['Average number of WC', 'Average number of BC', 'Wages per FTE (tot)', 'Wages per FTE (WC)', 'Wages per FTE (BC)'], { size: 6, colW: '3,1,1,1,1,1,1,1,1,1' }),
        LT('EBIT deviation', 0.3, 2.55, 10.3, 2.65, [['EBIT deviation vs LY/FC/R12', 'AC24 vs AC23', 'AC25 vs AC24', 'BU26 vs AC25', 'R12 vs BU26', 'F3PA26 vs BU26', 'F426 vs BU26', 'BU27 vs F426']],
          ['EBIT diff due to revenue', 'EBIT diff due to CM I%', 'EBIT diff due to CM II%', 'Other operating inc. & exp.', 'BC', 'WC', 'IT/consult', 'Mangement fee', 'Other SG&A', 'Depreciation', '*EBIT before PPA', 'PPA Depreciation', '*EBIT', 'Incr (+)/Decr (-) of FTE, WC', 'Incr (+)/Decr (-) of FTE, BC', 'Revenue growth %', 'CM II Growth %', 'Opex growth %'], { size: 5.5, colW: '3,1,1,1,1,1,1,1' }),
        LT('Other expenses spec', 0.3, 5.3, 10.3, 1.6, [['Specification - Other expenses', 'Actual 23', 'Actual 24', 'Actual Dec 25', 'Budget Dec 26', 'R12 Aug 26', 'Forecast 3 Dec 26', 'Forecast 4 Dec 26', 'Budget Dec 27']],
          ['Costs for premises', 'Energy costs', 'Repairs and maint', 'Costs f transp equip', 'Corporate insurance', 'Other external costs', 'Other', '*Other SG&A'], { size: 5.5, colW: '3,1,1,1,1,1,1,1,1' }),
        T('Comment to largest deviations', 10.75, 1.0, 2.35, 5.8, '# Comment to largest deviations:\n- \n- \n- ', 7)
      ], { tag: FB, small: 'continued' }),
      (function () {
        var h1 = ['', 'Total INRt'].concat(blanks(7)).concat(['Renewables INRt']).concat(blanks(5)).concat(['IAM/OEM INRt']).concat(blanks(5));
        var h2 = ['Profit and Loss', 'BU 2027', '%', 'FC 2026', '%', 'Dev.', '2025', '%', 'Dev.', 'BU 2027', '%', 'FC 2026', '%', '2025', '%', 'BU 2027', '%', 'FC 2026', '%', '2025', '%'];
        var L = ['Acc orders received external', 'External order book', '*Net Sales Total', 'Total Cost of Material', '*Contribution Margin I', 'Direct wages', 'Con. mater.', 'Sales freight', '*Contribution Margin II', 'Wages', 'Sales & market.', 'IT/Consult.', 'Management fees', 'Other SG&A', '*SG&A', 'Other operating inc. & exp.', '*EBITDA', 'Depreciations', '*EBIT before PPA', 'PPA depreciation', '*EBIT'];
        return S('budget-pl-ytd', 'Budget P&L YTD', [LT('Budget P&L YTD table', 0.3, 1.0, 12.75, 5.9, [h1, h2], L, { size: 6, colW: '3.2,1.1,0.7,1.1,0.7,1,1.1,0.7,1,1.1,0.7,1.1,0.7,1.1,0.7,1,0.7,1,0.7,1,0.7' })], { tag: FB });
      })(),
      monthlyPL('budget-pl-monthly', 'Budget P&L Monthly'),
      monthlyPL('budget-pl-ren', 'Budget P&L Monthly- REN'),
      (function () {
        var h1 = ['', '', 'Comp. Figures', '', '', '', 'BRIDGE Forecast 2026 --> Budget 2027', '', '', '', '', '', 'Sales growth BU 2027 vs…', '', '', ''];
        var h2 = ['Customer', 'Customer segment', 'Sales 2024', 'Sales 2025', 'Budget 2026', 'Forecast 2026', 'Price Change (INRt)', 'Volume Change (INRt)', 'Moved business (INRt)', 'New Business (INRt)', 'Lost Business (INRt)', 'Budget Sales 2027', 'Change BU27 vs. AC24', 'Change BU27 vs. AC25', 'Change BU27 vs. BU26', 'Change BU27 vs. FC26'];
        var body = blankRows(12, 16).concat([['External Sales Total'].concat(blanks(15)), ['Internal Sales'].concat(blanks(15)), ['Net Sales Total'].concat(blanks(15))]);
        var bold = [false, false].concat(blanks(12).map(function () { return false; })).concat([true, false, true]);
        return S('sales-bridge', 'Sales– Bridge', [
          TB('Sales bridge table', 0.3, 1.0, 12.75, 5.0, [h1, h2], body, { size: 6, bold: bold, colW: '2,1.6,1,1,1,1,1,1,1,1,1,1,1,1,1,1' }),
          T('Comment to largest deviations', 0.3, 6.1, 12.5, 0.85, '# Comment to largest deviations:\n- \n- ', 8)
        ], { tag: FB });
      })(),
      S('ebit-bridge', 'EBIT– Bridge', [
        IM('EBIT bridge chart (screenshot)', 0.3, 1.0, 9.0, 5.8),
        T('Comment to largest deviations', 9.5, 1.0, 3.5, 3.5, '# Comment to largest deviations:\n- \n- ', 9)
      ], { tag: FB }),
      S('cm', 'Contribution margin', [
        TB('Explanation of CM%', 0.5, 1.2, 6.0, 3.0, [['Explanation of CM%', '']], labelRows(['CM I% YTD', 'Material price changes', 'Purchase localization', 'Price change, customers', 'General Warranty', 'Mix & Others', 'CM I% Budget 2027'], 2),
          { size: 10, bold: [false, true, false, false, false, false, false, true], colW: '3,1' }),
        T('Comment', 6.8, 1.2, 4.5, 3.0, '# Comment:\n- \n- \n- ', 10)
      ], { tag: FB }),
      S('employees', 'No of employees', [
        LT('White collar FTE', 0.4, 1.1, 4.8, 4.8, [['', 'Number of FTE']], ['*No. of FTE White collar AC 2025', '', '', '', '*No. of FTE White collar AC Aug 26', '', '', '', '', '*No. of FTE White collar BU 2027'], { size: 8, colW: '3,1' }),
        LT('Blue collar FTE', 5.4, 1.1, 4.8, 4.8, [['', 'Number of FTE']], ['*No. of FTE Blue collar AC 2025', '', '', '', '*No. of FTE Blue collar AC Aug 26', '', '', '', '', '*No. of FTE Blue collar BU 2027'], { size: 8, colW: '3,1' }),
        T('Comment', 10.4, 1.1, 2.6, 3.0, '# Comment:\n- ', 9)
      ], { tag: FB }),
      (function () {
        var hdr = ['Approved (y/n)', 'Operation', 'Priority', 'Category', 'Description', 'Total Investment', 'Q3 2026', 'Q4 2026'].concat(MON.map(function (m) { return m + ' 27'; })).concat(['2026 - rest', '2027']);
        var body = blankRows(12, hdr.length).concat([['Total'].concat(blanks(hdr.length - 1))]);
        return S('capex', 'CAPEX', [
          TB('CAPEX table', 0.3, 1.0, 12.75, 5.0, [hdr], body, { size: 6, totalRow: true, caption: '(INRt) Capex 2026-2027', colW: '0.9,0.9,0.8,1.4,3.5,1,0.8,0.8,0.6,0.6,0.6,0.6,0.6,0.6,0.6,0.6,0.6,0.6,0.6,0.6,0.8,0.8' }),
          T('Comment', 0.3, 6.1, 12.5, 0.8, '# Comment:\n- ', 9)
        ], { tag: FB });
      })(),
      S('cost-spec-1', 'Cost specification', [
        LT('Consumption material', 0.3, 1.0, 8.5, 1.95, [['Consumption Material', '2024', '% TO', '2025', '% TO', 'FC2026', '% TO', 'B2027', '% TO']],
          ['Energy costs / COGS', 'Cons equip & tools / COGS', 'Oth cons equip & mtr / COGS', 'Cons equip & tools / Distr exp', 'Oth cons equip & mtr / Distr exp', '*Total'], { size: 7, colW: '3,1,1,1,1,1,1,1,1' }),
        T('Comment consumption', 9.0, 1.0, 4.0, 1.2, '# Comment:\n- ', 9),
        LT('Sales freight', 0.3, 3.15, 8.5, 0.6, [['Sales freight', '2024', '% TO', '2025', '% TO', 'FC2026', '% TO', 'B2027', '% TO']], ['Freight and carriage / Distr exp'], { size: 7, colW: '3,1,1,1,1,1,1,1,1' }),
        T('Comment freight', 9.0, 3.15, 4.0, 0.8, '# Comment:\n- ', 9),
        LT('IT / Consultant', 0.3, 4.15, 8.5, 2.3, [['IT/Consultant', '2024', '% CM II', '2025', '% CM II', 'FC2026', '% CM II', 'B2027', '% CM II']],
          ['IT costs / COGS', 'Consulting fees / COGS', 'IT costs / Distr exp', 'Consulting fees / Distr exp', 'IT costs / Admin exp', 'Consulting fees / Admin exp', '*Total'], { size: 7, colW: '3,1,1,1,1,1,1,1,1' }),
        T('Comment IT', 9.0, 4.15, 4.0, 1.2, '# Comment:\n- ', 9)
      ], { tag: FB }),
      S('cost-spec-2', 'Cost specification', [
        LT('Other costs', 0.3, 1.0, 8.5, 4.4, [['Other costs', '2024', '% CM II', '2025', '% CM II', 'FC2026', '% CM II', 'B2027', '% CM II']],
          ['Costs for premises', 'Repairs and maint', 'Costs f transp equip', 'Travel expenses', 'Marketings costs', 'Insurance', 'Auditor fee', 'Other external costs*', '*Total', '* Please limit use of', 'Other external costs / COGS', 'Other external costs / Distr exp', 'Other external costs / Admin exp'], { size: 7.5, colW: '3,1,1,1,1,1,1,1,1' }),
        T('Comment', 9.0, 1.0, 4.0, 1.6, '# Comment:\n- \n- ', 9)
      ], { tag: FB }),
      S('balance-sheet', 'Balance Sheet', [
        LT('Balance sheet table', 0.3, 1.0, 7.0, 5.9, [['Balance sheet', 'B2027', '%', 'FC2026', '%', '2025', '%']],
          ['Goodwill', 'Development & Patents', 'Other intangible fixed assets', 'Total tangible assets', 'Total financial assets', '*Total non-current assets', 'Total inventory', 'Accounts receivable, external', 'AR with factoring', 'Other receivables', 'Total cash, bank and equivalents', '*Total current assets', '*Total assets', '', '*Total equity', 'Group liabilities (long term)', 'Warranty provision', 'Financial liabilities', '*Total non-current liabilities', 'Accounts payable - trade', 'AP with Supply Chain Finance', 'Group liabilities (short term)', 'Warranty provision', 'Other liabilities', '*Total current liabilites', '*Total equity and liabilities'],
          { size: 6.5, caption: 'Total (INRt)', colW: '3,1,0.8,1,0.8,1,0.8' })
      ], { tag: FB }),
      (function () {
        var cols = ['Oct 26', 'Nov 26', 'Dec 26'].concat(MON.map(function (m) { return m + ' 27'; }));
        return S('nwc', 'NWC Overview', [
          LT('NWC table', 0.3, 1.0, 10.6, 5.9, [['(INRt)'].concat(cols)],
            ['*Net Working Capital', '*Spec of Working Capital:', 'Inventory', 'Accounts receivables ex', 'Accounts receivables in (non interest)', 'Other current receivables (non interest)', 'Prepaid expenses and accrued income', 'Longterm taxloan', 'Accounts payable ex', 'Accounts payable in (non interest)', 'Advances from customers', 'Other accounts payable', 'Accrued expenses and defered income', '*Δ NWC', 'External sales', 'Net Sales Total', 'Total Cost of Material', 'Total Other COGS', 'Inventory / Sales LTM %', 'NWC / Sales LTM %', 'Receivable days ex', 'Receivable days incl. in', 'Inventory days', 'Payable days ex', 'Payable days incl. in', 'Working capital days ex', 'Working capital days incl. in'],
            { size: 5.5, colW: '3.2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1' }),
          T('Comment', 11.0, 1.0, 2.1, 3.0, '# Comment:\n- ', 8)
        ], { tag: FB });
      })(),
      S('mwb-2027', '2027 Must Win Battles', [
        TB('Must win battles 2027', 0.6, 1.3, 11.6, 5.3, [['Must Win Battle', 'Status', 'Must Win Battle Lead']], blankRows(5, 3), { size: 12, statusCol: 1, colW: '6,1,3' })
      ], { tag: FB }),
      S('new-building', 'New Building Status', [
        T('Status list', 0.4, 1.1, 6.1, 5.8, '- \n-- \n- \n-- \n- \n-- \n- \n-- ', 11),
        IM('Building photo', 6.8, 1.1, 6.0, 3.2),
        T('Specification', 6.8, 4.45, 6.0, 2.4, '# Specification\n- \n- \n- ', 10)
      ]),
      COVER('cover-oem', 'Walk in: Indian OEM´s status / opportunities', 'Presenter name', 'Date'),
      S('potentials', 'Potentials in India Wind Market', [T('Topics', 0.8, 1.3, 10, 5, '- TOP OEMs in India\n\n- Customer: \n\n- Suppliers in India\n\n- Necessary resources required', 14)]),
      S('top-makers', 'Global Top Wind Turbine Makers by New Installations', [
        T('Installations', 0.4, 1.0, 5.6, 1.9, '# Installations India/Global\n\n2024: \n2025: ', 12),
        CH('Top 10 makers chart', 0.4, 3.0, 5.6, 3.9, 'bar', 'Top 10 global wind turbine makers in 2024', ['Maker 1', 'Maker 2', 'Maker 3', 'Maker 4', 'Maker 5', 'Maker 6', 'Maker 7', 'Maker 8', 'Maker 9', 'Maker 10'], [{ name: 'Onshore' }, { name: 'Offshore' }], { horizontal: true, stacked: true, legend: true }),
        CH('Top 15 makers chart', 6.3, 1.0, 6.7, 5.9, 'bar', 'Top 15 global wind turbine makers in 2025', ['Maker 1', 'Maker 2', 'Maker 3', 'Maker 4', 'Maker 5', 'Maker 6', 'Maker 7', 'Maker 8', 'Maker 9', 'Maker 10', 'Maker 11', 'Maker 12', 'Maker 13', 'Maker 14', 'Maker 15'], [{ name: 'Onshore' }, { name: 'Offshore' }], { horizontal: true, stacked: true, legend: true })
      ]),
      (function () {
        var h1 = ['Name'], h2 = ['Year'];
        for (var i = 1; i <= 6; i++) { h1.push('OEM ' + i, ''); h2.push('2025', '2024'); }
        return S('oem-finance', 'OEMs In India - Finance Data', [
          LT('OEM finance table', 0.3, 1.0, 12.75, 5.4, [h1, h2],
            ['*Financial Key figures (m EUR)', '*Income statement', 'Revenue', 'Gross margin(%)', 'Ebitda margin(%) before special items', 'Ebit margin(%) before special items', 'Ebitda margin(%)', 'Ebit margin(%)', '*Operational key figures', 'Order intake(MW)', 'Order backlog(MW)', 'Produced and shipped Total(MW)', 'Produced and shipped offshore(MW)', '*Other figures', 'Domestic ratio', 'Oversea ratio'],
            { size: 7, colW: '3,1,1,1,1,1,1,1,1,1,1,1,1' }),
          T('Footnote', 0.3, 6.5, 12, 0.4, '* ', 8)
        ]);
      })(),
      S('oem-production', 'OEMs In India - Production setup outside of India', [
        TB('Production setup table', 0.6, 1.0, 12.0, 3.2, [['WTG manufacturer', 'Oversea production site (Local content)', 'Established in', 'Assembly', 'Main turbine model']], blankRows(9, 5), { size: 8, firstColBold: true }),
        IM('Image 1', 2.4, 4.4, 3.6, 2.45), IM('Image 2', 7.1, 4.4, 3.6, 2.45)
      ]),
      S('oem-projects', 'OEMs in India - Part of oversea projects', [
        TB('Oversea projects table', 0.4, 1.0, 12.5, 5.9, [['OEM', 'Country', 'Project', 'Owner', 'MW', 'Turbine', 'Size(MW)', 'Qty']], blankRows(16, 8), { size: 7.5, firstColBold: true })
      ]),
      S('customer-approach', 'Customer – A better customer to approach', [
        T('Points', 0.4, 1.1, 8.0, 5.8, '- \n- \n- \n- ', 12),
        IM('Image', 8.6, 1.0, 4.4, 5.9)
      ]),
      S('customer-install-1', 'Customer - Oversea installation', [
        T('Points', 0.4, 1.0, 12.5, 0.95, '- Accumulated installation from oversea market … MW\n- Orders from oversea market … MW', 12),
        IM('Map / image', 0.4, 2.05, 12.5, 4.45),
        T('Footnote', 0.4, 6.55, 7, 0.4, '*All the data is accumulated by …', 8)
      ]),
      S('customer-install-2', 'Customer - Oversea installation', [
        T('Points', 0.4, 1.0, 12.5, 1.1, '- \n- ', 11),
        TB('Top 10 OEMs oversea', 3.3, 2.3, 6.8, 4.5, [['#', 'OEMs', 'Oversea Export Capacity (MW)', 'Oversea Export Units', 'Oversea Market Share']],
          [['1', '', '', '', ''], ['2', '', '', '', ''], ['3', '', '', '', ''], ['4', '', '', '', ''], ['5', '', '', '', ''], ['6', '', '', '', ''], ['7', '', '', '', ''], ['8', '', '', '', ''], ['9', '', '', '', ''], ['10', '', '', '', ''], ['', 'TOTAL', '', '', '']],
          { size: 8, totalRow: true, caption: 'Top 10 Wind Turbine OEMs - Oversea Business (Export & Production)', colW: '0.5,3,2,2,2' })
      ]),
      S('customer-challenges', 'Customer - Challenges', [
        T('Points', 0.4, 1.0, 12, 0.9, '- ', 12),
        LT('General terms', 1.6, 2.0, 7.0, 4.4, [['Terms', 'Content']], ['Price level', 'Warranty period', 'Payment terms', 'Payment method', 'PO/Forecast', 'Retainer', 'Development cost', 'Stock risk'],
          { size: 9, firstColBold: true, caption: 'General terms from customer', colW: '1.3,4' })
      ]),
      (function () {
        var h1 = ['Name', 'Supplier 1', '', '', 'Supplier 2', '', '', 'Supplier 3', '', ''];
        var h2 = ['Year', 'H1', '2025', '2024', 'H1', '2025', '2024', 'H1', '2025', '2024'];
        return S('suppliers', 'Suppliers in India', [
          LT('Suppliers finance table', 0.4, 1.0, 12.5, 3.0, [h1, h2], ['Revenue', 'Gross margin%', 'EBITDA Margin%', 'EBIT Margin%', 'Accounts Receivable(Days)', 'Inventory Turnover Ratio(Days)', 'Export business%', 'Gross margin (Export)%'], { size: 7, firstColBold: true, colW: '2.4,1,1,1,1,1,1,1,1,1' }),
          T('Notes', 0.4, 4.2, 12.5, 2.6, '- \n- \n- \n- ', 9)
        ]);
      })(),
      S('resources', 'Necessary Resources', [T('Resources', 0.8, 1.2, 11, 5, '- \n\n- \n\n- \n\n- \n\n- ', 12)]),
      END('end', 'Thanks for your attention')
    ];
    /* keep left-edge blocks clear of the yellow corner wedge; tag each slide with its category */
    list.forEach(function (sl) {
      sl.section = SECTION_BY_TPL[sl.tpl] || 'Other';
      (sl.blocks || []).forEach(function (b) { if (b.x < 0.5) { var d = 0.5 - b.x; b.x = 0.5; b.w = +(b.w - d).toFixed(2); } });
    });
    return list;
  }

  /* ---------- categories (exported as PowerPoint sections) ---------- */
  var SECTION_BY_TPL = {
    'cover': 'Opening',
    'sales-overview': 'Sales', 'sales': 'Sales', 'low-margin': 'Sales',
    'production': 'Production',
    'procurement-1': 'Procurement', 'procurement-2': 'Procurement', 'supplier-matrix': 'Procurement',
    'projects': 'Projects/Engineering',
    'qhse-1': 'QHSE', 'qhse-2': 'QHSE',
    'finance': 'Finance',
    'it': 'IT',
    'people': 'People & Culture',
    'strategy-2026': 'Strategy',
    'cover-finance': 'Financial reporting', 'monthly-report': 'Financial reporting', 'forecast-2026': 'Financial reporting',
    'cover-budget': 'Forecast 2026 & Budget 2027', 'content': 'Forecast 2026 & Budget 2027', 'budget-assumption': 'Forecast 2026 & Budget 2027',
    'upsides': 'Forecast 2026 & Budget 2027', 'kpi-1': 'Forecast 2026 & Budget 2027', 'kpi-2': 'Forecast 2026 & Budget 2027',
    'budget-pl-ytd': 'Forecast 2026 & Budget 2027', 'budget-pl-monthly': 'Forecast 2026 & Budget 2027', 'budget-pl-ren': 'Forecast 2026 & Budget 2027',
    'budget-pl-iam': 'Forecast 2026 & Budget 2027',
    'sales-bridge': 'Forecast 2026 & Budget 2027', 'ebit-bridge': 'Forecast 2026 & Budget 2027', 'cm': 'Forecast 2026 & Budget 2027',
    'employees': 'Forecast 2026 & Budget 2027', 'capex': 'Forecast 2026 & Budget 2027', 'cost-spec-1': 'Forecast 2026 & Budget 2027',
    'cost-spec-2': 'Forecast 2026 & Budget 2027', 'balance-sheet': 'Forecast 2026 & Budget 2027', 'nwc': 'Forecast 2026 & Budget 2027',
    'mwb-2027': 'Forecast 2026 & Budget 2027',
    'new-building': 'New building',
    'cover-oem': 'OEM status & opportunities', 'potentials': 'OEM status & opportunities', 'top-makers': 'OEM status & opportunities',
    'oem-finance': 'OEM status & opportunities', 'oem-production': 'OEM status & opportunities', 'oem-projects': 'OEM status & opportunities',
    'customer-approach': 'OEM status & opportunities', 'customer-install-1': 'OEM status & opportunities',
    'customer-install-2': 'OEM status & opportunities', 'customer-challenges': 'OEM status & opportunities',
    'suppliers': 'OEM status & opportunities', 'resources': 'OEM status & opportunities',
    'end': 'Closing'
  };
  /* A slide's category: its own, else its template's, else the previous slide's (reports saved
     before categories existed get them automatically). */
  function sectionOf(slide, prev) {
    var v = slide && typeof slide.section === 'string' ? slide.section.trim() : '';
    return v || SECTION_BY_TPL[slide && slide.tpl] || prev || 'Other';
  }
  /* [{ slide, section }] for every slide, in order. */
  function sectionsFor(slides) {
    var prev = '';
    return slides.map(function (s) { prev = sectionOf(s, prev); return { slide: s, section: prev }; });
  }

  /* ---------- helpers ---------- */
  function parseNum(s) {
    if (s == null) return null;
    var t = String(s).trim();
    if (t === '' || t === '-') return null;
    var neg = /^\(.*\)$/.test(t);
    t = t.replace(/[(),\s]/g, '');
    var pct = /%$/.test(t);
    t = t.replace(/%$/, '');
    var n = parseFloat(t);
    if (isNaN(n)) return null;
    if (neg) n = -n;
    return pct ? n / 100 : n;
  }
  function chartFormat(b, only) {
    var pct = false, dec = 0;
    (only || b.series).forEach(function (s) {
      s.values.forEach(function (v) {
        var t = String(v == null ? '' : v).trim();
        if (/%$/.test(t)) pct = true;
        var m = t.replace(/%$/, '').match(/\.(\d+)/);
        if (m) dec = Math.max(dec, m[1].length);
      });
    });
    dec = Math.min(dec, 2);
    return { pct: pct, dec: dec, code: pct ? ('0' + (dec ? '.' + '0'.repeat(dec) : '') + '%') : ('#,##0' + (dec ? '.' + '0'.repeat(dec) : '')) };
  }
  function seriesPct(s) { return s.values.some(function (v) { return /%\s*$/.test(String(v || '')); }); }
  function fmtVal(v, f) {
    if (v == null) return '';
    if (f.pct) return (v * 100).toFixed(f.dec) + '%';
    return v.toLocaleString('en-US', { minimumFractionDigits: f.dec, maximumFractionDigits: f.dec });
  }
  function isNumLike(s) { return /^\(?[-+]?[\d,.\s]+\)?%?$/.test(String(s).trim()) && /\d/.test(String(s)); }

  /* text markup -> paragraph model */
  function parseText(text) {
    return String(text || '').split('\n').map(function (line) {
      var m;
      if ((m = line.match(/^#g\s?(.*)$/))) return { k: 'h', t: m[1], color: '00B050', big: true };
      if ((m = line.match(/^#r\s?(.*)$/))) return { k: 'h', t: m[1], color: 'FF0000', big: true };
      if ((m = line.match(/^#\s?(.*)$/))) return { k: 'h', t: m[1] };
      if ((m = line.match(/^--\s?(.*)$/))) return { k: 'b2', t: m[1] };
      if ((m = line.match(/^-\s?(.*)$/))) return { k: 'b', t: m[1] };
      if ((m = line.match(/^v\s(.*)$/)) || line === 'v') return { k: 'chk', t: m ? m[1] : '' };
      if ((m = line.match(/^\*\s?(.*)$/))) return { k: 'dot', t: m[1] };
      return { k: 'p', t: line };
    });
  }
  /* bullets with no text are left out of the export */
  function exportParas(text) {
    var ps = parseText(text).filter(function (p) { return !(p.k !== 'p' && p.k !== 'h' && !p.t.trim()); });
    while (ps.length && ps[ps.length - 1].k === 'p' && !ps[ps.length - 1].t.trim()) ps.pop();
    return ps;
  }

  function colWidths(b) {
    var nc = b.rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    var manual = String(b.colW || '').split(',').map(function (x) { return parseFloat(x); }).filter(function (x) { return !isNaN(x) && x > 0; });
    var wts = [];
    for (var c = 0; c < nc; c++) {
      if (manual.length === nc) { wts.push(manual[c]); continue; }
      var mx = 3;
      b.rows.forEach(function (r, ri) { var t = String(r[c] || ''); if (ri < b.header && t.length > 14) return; mx = Math.max(mx, Math.min(t.length, 40)); });
      wts.push(mx);
    }
    var sum = wts.reduce(function (a, x) { return a + x; }, 0) || 1;
    return wts.map(function (x) { return x / sum; });
  }
  /* header rows stay compact; body rows share the remaining height */
  function rowHeights(b, hh) {
    var n = b.rows.length || 1, hdr = Math.min(b.header || 0, n);
    var even = hh / n, fs = +b.size || 8;
    var hH = Math.min(even, Math.max(0.2, fs * 2.8 / 72) * (b.header > 0 && b.rows[0].some(function (c) { return String(c).length > 18; }) ? 1.5 : 1));
    var bH = n > hdr ? (hh - hH * hdr) / (n - hdr) : even;
    var out = [];
    for (var i = 0; i < n; i++) out.push(+Math.max(0.1, i < hdr ? hH : bH).toFixed(3));
    return out;
  }
  function normStatus(v) {
    var t = String(v || '').trim().toUpperCase();
    if (t === 'G' || t === 'GREEN') return 'G';
    if (t === 'Y' || t === 'YELLOW' || t === 'A' || t === 'AMBER') return 'Y';
    if (t === 'R' || t === 'RED') return 'R';
    return '';
  }

  /* ---------- PPTX export ---------- */
  function buildPptx(PptxGenJS, project, assets) {
    var pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = project.settings.author || 'HydraSpecma India';
    pptx.company = 'HydraSpecma';
    pptx.title = project.settings.reportTitle || 'Management Report';
    var page = 0, lastSec = null, curTitle = null, used = {};
    sectionsFor(project.slides).forEach(function (item) {
      var s = item.slide;
      if (!s.include) return;
      page++;
      if (item.section !== lastSec) {
        // PowerPoint matches sections by title, so a category that comes back later gets a suffix.
        var title = item.section, n = 2;
        while (used[title]) title = item.section + ' (' + (n++) + ')';
        used[title] = true; lastSec = item.section;
        pptx.addSection({ title: title });
        curTitle = title;
      }
      var sl = pptx.addSlide({ sectionTitle: curTitle });
      if (s.layout === 'cover' || s.layout === 'end') {
        sl.background = { data: assets.bgCover };
        if (s.layout === 'cover') {
          sl.addText([{ text: 'Hydra', options: { color: 'FFFFFF' } }, { text: 'Specma', options: { color: YEL } }],
            { x: 0.7, y: 2.35, w: 9, h: 1.1, fontFace: 'Arial', fontSize: 60, bold: true, margin: 0 });
          sl.addText(s.subtitle || '', { x: 0.75, y: 3.7, w: 9.5, h: 0.6, fontFace: 'Arial', fontSize: 20, color: 'D0D0D0', margin: 0 });
          sl.addText([{ text: s.presenter || '', options: { breakLine: true } }, { text: s.date || '' }],
            { x: 9.0, y: 4.85, w: 3.4, h: 0.95, fontFace: 'Arial', fontSize: 18, color: 'D0D0D0', margin: 0, paraSpaceAfter: 6, valign: 'top' });
        } else {
          sl.addText(s.title || '', { x: 0.75, y: 2.0, w: 11, h: 1.0, fontFace: 'Arial', fontSize: 34, bold: true, color: YEL, align: 'center', margin: 0 });
        }
      } else {
        sl.background = { data: assets.bgContent };
        var ty = 0.22;
        if (s.tag) {
          sl.addShape(pptx.ShapeType ? pptx.ShapeType.rect : 'rect', { x: 0.69, y: 0.14, w: 2.0, h: 0.26, fill: { color: YEL }, line: { color: YEL } });
          sl.addText(s.tag, { x: 0.69, y: 0.14, w: 2.0, h: 0.26, fontFace: 'Arial', fontSize: 7, bold: true, color: '000000', align: 'center', valign: 'middle', margin: 0 });
          ty = 0.48;
        }
        var runs = [{ text: s.title || '', options: { bold: true, fontSize: 26 } }];
        if (s.titleSmall) runs.push({ text: '  ' + s.titleSmall, options: { bold: false, fontSize: 15 } });
        sl.addText(runs, { x: 0.95, y: ty, w: 11.6, h: 0.65, fontFace: 'Arial', color: '000000', valign: 'middle', margin: 0 });
      }
      if (project.settings.pageNumbers !== false) {
        sl.addText(String(page), { x: 12.35, y: 0.07, w: 0.75, h: 0.25, fontFace: 'Arial', fontSize: 8, color: '8C8C8C', align: 'right', margin: 0 });
      }
      (s.blocks || []).forEach(function (b) {
        try { exportBlock(pptx, sl, b); } catch (e) { if (typeof console !== 'undefined') console.warn('block export failed', b.label, e); }
      });
    });
    return pptx;
  }

  function exportBlock(pptx, sl, b) {
    var box = { x: +b.x, y: +b.y, w: +b.w, h: +b.h };
    if (b.type === 'text') {
      var ps = exportParas(b.text);
      if (!ps.length) return;
      var fs = +b.size || 10;
      var arr = ps.map(function (p) {
        var o = { breakLine: true, fontSize: fs, paraSpaceBefore: 2 };
        if (p.k === 'h') { o.bold = true; o.color = p.color || '000000'; o.bullet = false; if (p.big) o.fontSize = fs + 2; o.paraSpaceBefore = 5; }
        else if (p.k === 'b') { o.bullet = { characterCode: '25AA', color: YEL, indent: Math.round(fs * 1.5) }; }
        else if (p.k === 'b2') { o.bullet = { characterCode: '25AA', color: YEL, indent: Math.round(fs * 1.5) }; o.indentLevel = 1; }
        else if (p.k === 'chk') { o.bullet = { characterCode: '2713', color: '000000', indent: Math.round(fs * 1.7) }; }
        else if (p.k === 'dot') { o.bullet = { characterCode: '2022', color: YEL, indent: Math.round(fs * 1.5) }; }
        else { o.bullet = false; }
        return { text: p.t || ' ', options: o };
      });
      sl.addText(arr, Object.assign({}, box, { fontFace: 'Arial', fontSize: fs, color: '000000', valign: 'top', margin: 0.04, fit: 'shrink' }));
    } else if (b.type === 'table') {
      var rows = b.rows || [];
      if (!rows.length) return;
      var y0 = box.y, hh = box.h;
      if (b.caption) {
        sl.addText(b.caption, { x: box.x, y: y0, w: box.w, h: 0.26, fontFace: 'Arial', fontSize: Math.max(8, (+b.size || 8) + 1), bold: true, margin: 0, valign: 'middle' });
        y0 += 0.28; hh -= 0.28;
      }
      var nc = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
      var cw = colWidths(b).map(function (f) { return +(f * box.w).toFixed(3); });
      var fs2 = +b.size || 8;
      var rowH = rowHeights(b, hh);
      var data = rows.map(function (r, ri) {
        var isH = ri < b.header, isTot = b.totalRow && ri === rows.length - 1, bold = !!(b.rowBold && b.rowBold[ri]);
        var cells = [];
        for (var c = 0; c < nc; c++) {
          var cf = cellFill(r[c]), v = cf.text;
          var o = { fontSize: fs2, fontFace: 'Arial', color: '000000', valign: 'middle', margin: [1, 3, 1, 3] };
          if (cf.fill) o.fill = { color: cf.fill };
          if (isH) { o.bold = true; o.fill = { color: YEL }; o.align = c === 0 ? 'left' : 'center'; }
          else {
            if (isTot) { o.bold = true; o.fill = { color: 'FFF2CC' }; }
            if (bold) o.bold = true;
            if (b.firstColBold && c === 0) o.bold = true;
            o.align = (c > 0 && isNumLike(v)) ? 'right' : 'left';
            if (c === b.statusCol) {
              var st = normStatus(v);
              if (st) { v = '●'; o.color = STATUS[st]; o.fontSize = Math.max(fs2 * 2.2, 16); o.align = 'center'; }
            }
          }
          cells.push({ text: v, options: o });
        }
        return cells;
      });
      sl.addTable(data, { x: box.x, y: y0, w: box.w, colW: cw, rowH: rowH, border: { type: 'solid', pt: 0.5, color: 'BFBFBF' }, autoPage: false });
    } else if (b.type === 'chart') {
      exportChart(pptx, sl, b, box);
    } else if (b.type === 'image') {
      if (!b.src) return;
      var r = fitRect(b, box);
      if (b.fit === 'cover') sl.addImage({ data: b.src, x: box.x, y: box.y, w: box.w, h: box.h, sizing: { type: 'cover', w: box.w, h: box.h } });
      else sl.addImage({ data: b.src, x: r.x, y: r.y, w: r.w, h: r.h });
    }
  }
  function fitRect(b, box) {
    if (b.fit === 'stretch' || !b.iw || !b.ih) return box;
    var ar = b.iw / b.ih, bar = box.w / box.h, w, h;
    if (ar > bar) { w = box.w; h = w / ar; } else { h = box.h; w = h * ar; }
    return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w: w, h: h };
  }

  function exportChart(pptx, sl, b, box) {
    var CT = pptx.ChartType || pptx.charts;
    var cats = b.cats.map(function (c) { return String(c == null ? '' : c); });
    var f = chartFormat(b);
    var base = {
      x: box.x, y: box.y, w: box.w, h: box.h,
      showTitle: !!b.title, title: b.title || '', titleFontSize: 10, titleFontFace: 'Arial', titleColor: '000000',
      showLegend: !!b.legend, legendPos: 'b', legendFontSize: 7, legendFontFace: 'Arial',
      catAxisLabelFontSize: 7, catAxisLabelFontFace: 'Arial', catAxisLabelColor: '404040',
      valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' },
      dataLabelFontSize: 7, dataLabelFontFace: 'Arial', dataLabelColor: '000000', dataLabelFormatCode: f.code
    };
    var anyVal = b.series.some(function (s) { return s.values.some(function (v) { return parseNum(v) != null; }); });
    var mk = function (s) { return { name: s.name || ' ', labels: cats, values: s.values.map(function (v) { var n = parseNum(v); return n == null ? null : n; }) }; };
    if (b.chartType === 'pie' || b.chartType === 'doughnut') {
      var s0 = b.series[0];
      if (!s0) return;
      var pf = chartFormat(b, [s0]);
      var pd = mk(s0);
      if (anyVal && (b.labels || b.legend)) pd.labels = cats.map(function (c, i) { var n = parseNum(s0.values[i]); return n == null ? c : c + ', ' + fmtVal(n, pf); });
      sl.addChart(b.chartType === 'pie' ? CT.pie : CT.doughnut, [pd], Object.assign(base, {
        dataLabelFormatCode: '0%',
        chartColors: cats.map(function (c, i) { return PALETTE[i % PALETTE.length]; }),
        /* with a legend the names + values move to the legend and the slices only show % (keeps small slices readable) */
        showValue: false, showPercent: anyVal && b.labels, showLabel: anyVal && b.labels && !b.legend, showLeaderLines: true,
        dataLabelPosition: b.chartType === 'pie' ? 'bestFit' : undefined, holeSize: 55, showLegend: !!b.legend, legendPos: 'r'
      }));
      return;
    }
    var bars = b.chartType === 'line' ? [] : b.series.filter(function (s) { return b.chartType === 'bar' || s.kind !== 'line'; });
    var lines = b.chartType === 'line' ? b.series : (b.chartType === 'combo' ? b.series.filter(function (s) { return s.kind === 'line'; }) : []);
    var fb = chartFormat(b, bars.length ? bars : lines);
    base.dataLabelFormatCode = fb.code;
    var common = { barDir: b.horizontal ? 'bar' : 'col', barGrouping: b.stacked ? 'stacked' : 'clustered', barGapWidthPct: 60 };
    if (b.chartType === 'combo' && bars.length && lines.length) {
      var sec = lines.some(function (s) { return s.axis === 'secondary'; });
      var types = [{ type: CT.bar, data: bars.map(mk), options: Object.assign({ chartColors: bars.map(function (s) { return s.color; }) }, common, { showValue: anyVal && b.labels, dataLabelPosition: b.stacked ? 'ctr' : 'outEnd', dataLabelFormatCode: fb.code }) }];
      lines.forEach(function (s) {
        var lf = chartFormat(b, [s]).code;
        types.push({ type: CT.line, data: [mk(s)], options: { chartColors: [s.color], lineSize: 2, lineDataSymbol: 'circle', lineDataSymbolSize: 5, secondaryValAxis: sec && s.axis === 'secondary', secondaryCatAxis: sec && s.axis === 'secondary', showValue: anyVal && b.labels, dataLabelPosition: 't', dataLabelFormatCode: lf } });
      });
      var opts = Object.assign(base, { valAxes: [{ showValAxisTitle: false, valAxisHidden: true, valGridLine: { style: 'none' } }], catAxes: [{ catAxisTitle: '' }] });
      if (sec) {
        var sf = chartFormat(b, lines.filter(function (s) { return s.axis === 'secondary'; }));
        opts.valAxes.push({ showValAxisTitle: false, valAxisHidden: false, valAxisLabelFontSize: 7, valAxisLabelFormatCode: sf.code, valAxisMinVal: 0, valGridLine: { style: 'none' } });
        opts.catAxes.push({ catAxisHidden: true });
      }
      sl.addChart(types, opts);
      return;
    }
    if (lines.length && !bars.length) {
      sl.addChart(CT.line, lines.map(mk), Object.assign(base, { chartColors: lines.map(function (s) { return s.color; }), lineSize: 2, lineDataSymbol: 'circle', lineDataSymbolSize: 5, showValue: anyVal && b.labels, dataLabelPosition: 't' }));
      return;
    }
    sl.addChart(CT.bar, bars.map(mk), Object.assign(base, common, {
      chartColors: bars.map(function (s) { return s.color; }),
      showValue: anyVal && b.labels, dataLabelPosition: b.stacked ? 'ctr' : 'outEnd'
    }));
  }

  function newProject() {
    return { version: 1, settings: { reportTitle: 'Renewables India Management Report', fileName: 'HySp_India_Board_Meeting_Management_Report', pageNumbers: true, author: '' }, slides: TEMPLATE() };
  }

  G.HSCore = {
    W: W, H: H, YEL: YEL, PALETTE: PALETTE, STATUS: STATUS, M12: M12, MON: MON, ACN: ACN,
    uid: uid, T: T, TB: TB, CH: CH, IM: IM, S: S, COVER: COVER, END: END, blanks: blanks, blankRows: blankRows,
    TEMPLATE: TEMPLATE, newProject: newProject, SECTION_BY_TPL: SECTION_BY_TPL, sectionOf: sectionOf, sectionsFor: sectionsFor, parseNum: parseNum, chartFormat: chartFormat, fmtVal: fmtVal, seriesPct: seriesPct,
    parseText: parseText, rowHeights: rowHeights, exportParas: exportParas, colWidths: colWidths, normStatus: normStatus, cellFill: cellFill, isNumLike: isNumLike, fitRect: fitRect,
    buildPptx: buildPptx
  };
})(typeof window !== 'undefined' ? window : globalThis);
