(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LeadStudioExport = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var COLUMNS = Object.freeze([
    ["Email Date", "emailDate"],
    ["Company Name", "companyName"],
    ["Name", "name"],
    ["Last Name", "lastName"],
    ["Contact Email", "contactEmail"],
    ["Target Region", "targetRegion"],
    ["Business Type", "businessType"],
    ["Interested in", "interestedIn"],
    ["Language", "language"],
    ["Jira Issue Key", "jiraIssueKey"],
    ["Jira Issue URL", "jiraIssueUrl"],
    ["Jira Status", "jiraStatus"],
    ["Onboarding Complete", "onboardingComplete"],
    ["Last Checked", "lastChecked"]
  ]);
  var crcTable;

  function buildExportRows(leads) {
    return {
      headers: COLUMNS.map(function (column) { return column[0]; }),
      rows: (leads || []).map(function (lead) {
        return COLUMNS.map(function (column) {
          var value = lead && lead[column[1]];
          return value == null ? "" : String(value);
        });
      })
    };
  }

  function buildExportFilename(format, status, date) {
    var parts = ["lead-studio"];
    var statusPart = slugify(status);
    if (statusPart) parts.push(statusPart);
    parts.push("visible", (date || new Date()).toISOString().slice(0, 10));
    return parts.join("-") + "." + String(format || "csv").toLowerCase();
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function createCsvBlob(headers, rows) {
    var lines = [headers].concat(rows).map(function (row) {
      return row.map(escapeCsvCell).join(",");
    });
    return new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  }

  function escapeCsvCell(value) {
    return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"';
  }

  function createXlsxBlob(headers, rows) {
    var sheetRows = [headers].concat(rows);
    var files = {
      "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
      "_rels/.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      "xl/workbook.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Visible Leads" sheetId="1" r:id="rId1"/></sheets></workbook>',
      "xl/_rels/workbook.xml.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      "xl/styles.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>',
      "xl/worksheets/sheet1.xml": buildWorksheetXml(sheetRows)
    };
    return new Blob([createZipBytes(files)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
  }

  function buildWorksheetXml(rows) {
    var sheetData = rows.map(function (row, rowIndex) {
      var cells = row.map(function (value, columnIndex) {
        var ref = getColumnName(columnIndex + 1) + (rowIndex + 1);
        return '<c r="' + ref + '" t="inlineStr"><is><t>' + escapeXml(value) + "</t></is></c>";
      }).join("");
      return '<row r="' + (rowIndex + 1) + '">' + cells + "</row>";
    }).join("");
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + sheetData + "</sheetData></worksheet>";
  }

  function getColumnName(index) {
    var name = "";
    var cursor = index;
    while (cursor > 0) {
      var remainder = (cursor - 1) % 26;
      name = String.fromCharCode(65 + remainder) + name;
      cursor = Math.floor((cursor - 1) / 26);
    }
    return name;
  }

  function escapeXml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function createZipBytes(files) {
    var encoder = new TextEncoder();
    var localParts = [];
    var centralParts = [];
    var now = new Date();
    var dosTime = ((now.getHours() & 31) << 11) | ((now.getMinutes() & 63) << 5) | (Math.floor(now.getSeconds() / 2) & 31);
    var dosDate = (((now.getFullYear() - 1980) & 127) << 9) | (((now.getMonth() + 1) & 15) << 5) | (now.getDate() & 31);
    var offset = 0;

    Object.keys(files).forEach(function (path) {
      var nameBytes = encoder.encode(path);
      var contentBytes = encoder.encode(files[path]);
      var crc = crc32(contentBytes);
      var localHeader = createZipHeader(0x04034b50, [20, 0, 0, dosTime, dosDate, crc, contentBytes.length, contentBytes.length, nameBytes.length, 0]);
      localParts.push(localHeader, nameBytes, contentBytes);
      var centralHeader = createZipHeader(0x02014b50, [20, 20, 0, 0, dosTime, dosDate, crc, contentBytes.length, contentBytes.length, nameBytes.length, 0, 0, 0, 0, 0, offset]);
      centralParts.push(centralHeader, nameBytes);
      offset += localHeader.length + nameBytes.length + contentBytes.length;
    });

    var centralSize = centralParts.reduce(function (total, part) { return total + part.length; }, 0);
    var entryCount = Object.keys(files).length;
    var endRecord = createZipHeader(0x06054b50, [0, 0, entryCount, entryCount, centralSize, offset, 0]);
    return concatUint8Arrays(localParts.concat(centralParts, [endRecord]));
  }

  function createZipHeader(signature, fields) {
    var sizes = signature === 0x02014b50
      ? [2, 2, 2, 2, 2, 2, 4, 4, 4, 2, 2, 2, 2, 2, 4, 4]
      : signature === 0x06054b50
        ? [2, 2, 2, 2, 4, 4, 2]
        : [2, 2, 2, 2, 2, 4, 4, 4, 2, 2];
    var bytes = new Uint8Array(4 + sizes.reduce(function (total, size) { return total + size; }, 0));
    var view = new DataView(bytes.buffer);
    var offset = 0;
    view.setUint32(offset, signature, true);
    offset += 4;
    fields.forEach(function (value, index) {
      if (sizes[index] === 2) view.setUint16(offset, value, true);
      else view.setUint32(offset, value, true);
      offset += sizes[index];
    });
    return bytes;
  }

  function concatUint8Arrays(parts) {
    var totalLength = parts.reduce(function (total, part) { return total + part.length; }, 0);
    var output = new Uint8Array(totalLength);
    var offset = 0;
    parts.forEach(function (part) {
      output.set(part, offset);
      offset += part.length;
    });
    return output;
  }

  function crc32(bytes) {
    var crc = -1;
    bytes.forEach(function (byte) {
      crc = (crc >>> 8) ^ getCrcTable()[(crc ^ byte) & 0xff];
    });
    return (crc ^ -1) >>> 0;
  }

  function getCrcTable() {
    if (crcTable) return crcTable;
    crcTable = Array.from({ length: 256 }, function (_, index) {
      var cursor = index;
      for (var bit = 0; bit < 8; bit += 1) {
        cursor = cursor & 1 ? 0xedb88320 ^ (cursor >>> 1) : cursor >>> 1;
      }
      return cursor >>> 0;
    });
    return crcTable;
  }

  return Object.freeze({
    buildExportRows: buildExportRows,
    buildExportFilename: buildExportFilename,
    createCsvBlob: createCsvBlob,
    createXlsxBlob: createXlsxBlob
  });
});
