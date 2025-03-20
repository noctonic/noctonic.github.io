function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateRunProperties(style) {
  let props = '';
  if (style.bold) props += '<w:b/>';
  if (style.italic) props += '<w:i/>';
  if (style.underline) props += '<w:u w:val="single"/>';
  if (style.code) props += '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>';

  if (style.strikethrough) {
    props += '<w:strike/>';
  }

  if (style.vertAlign === 'subscript') {
    props += '<w:vertAlign w:val="subscript"/>';
  } else if (style.vertAlign === 'superscript') {
    props += '<w:vertAlign w:val="superscript"/>';
  }

  if (style.highlight) {
    props += '<w:highlight w:val="yellow"/>';
  }

  return props ? `<w:rPr>${props}</w:rPr>` : '';
}

function processList(listElem, level, isOrdered) {
  let result = '';
  const numId = isOrdered ? 20 : 10;

  listElem.childNodes.forEach(li => {
    if (li.nodeType === Node.ELEMENT_NODE && li.tagName.toLowerCase() === 'li') {
      const inlineNodes = [];
      const nestedLists = [];

      li.childNodes.forEach(child => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const childTag = child.tagName.toLowerCase();
          if (childTag === 'ul' || childTag === 'ol') {
            nestedLists.push(child);
          } else {
            inlineNodes.push(child);
          }
        } else {
          inlineNodes.push(child);
        }
      });

      const inlineXml = processInlineNodes({ childNodes: inlineNodes });

      result += `
        <w:p>
          <w:pPr>
            <w:pStyle w:val="ListParagraph"/>
            <w:numPr>
              <w:ilvl w:val="${level}"/>
              <w:numId w:val="${numId}"/>
            </w:numPr>
          </w:pPr>
          ${inlineXml}
        </w:p>
      `;

      nestedLists.forEach(subList => {
        const isSubOrdered = (subList.tagName.toLowerCase() === 'ol');
        result += processList(subList, level + 1, isSubOrdered);
      });
    }
  });

  return result;
}


function processInlineNodes(node, styleContext = {}) {
  let result = '';
  node.childNodes.forEach((child) => {

    if (child.nodeType === Node.TEXT_NODE) {
      if (child.textContent.trim().length === 0) {
        return; 
      }
      result += `<w:r>${generateRunProperties(styleContext)}<w:t xml:space="preserve">${escapeXml(child.textContent)}</w:t></w:r>`;

    } else if (child.nodeType === Node.ELEMENT_NODE) {
      let newStyle = Object.assign({}, styleContext);
      const tag = child.tagName.toLowerCase();

      if (tag === 'strong' || tag === 'b') newStyle.bold = true;
      if (tag === 'em' || tag === 'i') newStyle.italic = true;
      if (tag === 'u') newStyle.underline = true;
      if (tag === 'code') newStyle.code = true;

      if (tag === 's' || tag === 'strike' || tag === 'del') {
        newStyle.strikethrough = true;
      }

      if (tag === 'sub') {
        newStyle.vertAlign = 'subscript';
      } else if (tag === 'sup') {
        newStyle.vertAlign = 'superscript';
      }

      if (tag === 'mark') {
        newStyle.highlight = true;
      }

      if (tag === 'a') {
        newStyle.underline = true;
      }

      if (tag === 'br') {
        result += `<w:r><w:br/></w:r>`;
      }

      else {
        result += processInlineNodes(child, newStyle);
      }
    }

  });
  return result;
}


function processTable(tableElem) {
  let tableResult = `
    <w:tbl>
      <w:tblPr>
        <!-- Apply your table style, e.g. "TableNormal" -->
        <w:tblStyle w:val="TableNormal"/>
        
        <!-- Let Word auto-size columns -->
        <w:tblW w:w="0" w:type="auto"/>
        <w:tblLayout w:type="autofit"/>
      </w:tblPr>
  `;

  tableElem.childNodes.forEach((section) => {
    const sectionTag = (section.tagName || '').toLowerCase();
    if (sectionTag === 'thead' || sectionTag === 'tbody' || sectionTag === 'tfoot') {
      section.childNodes.forEach((row) => {
        if (row.tagName && row.tagName.toLowerCase() === 'tr') {
          tableResult += processTableRow(row);
        }
      });
    } else if (sectionTag === 'tr') {
      tableResult += processTableRow(section);
    }
  });

  tableResult += '</w:tbl>';
  return tableResult;
}

function processTableRow(trElem) {
  let rowResult = '<w:tr>';
  trElem.childNodes.forEach((cell) => {
    const cellTag = (cell.tagName || '').toLowerCase();
    if (cellTag === 'th' || cellTag === 'td') {
      rowResult += processTableCell(cell, cellTag);
    }
  });
  rowResult += '</w:tr>';
  return rowResult;
}

function processTableCell(cellElem, cellTag) {
  const isHeader = (cellTag === 'th');
  let cellResult = '<w:tc>';

  const content = processInlineNodes(cellElem);

  if (isHeader) {
    cellResult += `
      <w:p>
        <w:pPr><w:pStyle w:val="TableHeader"/></w:pPr>
        <w:r><w:rPr><w:b/></w:rPr>
          <w:t xml:space="preserve">${escapeXml(cellElem.textContent)}</w:t>
        </w:r>
      </w:p>
    `;
  } else {
    cellResult += `
      <w:p>
        ${content}
      </w:p>
    `;
  }

  cellResult += '</w:tc>';
  return cellResult;
}

function processDefinitionList(dlElem) {
  let dlResult = '';
  
  dlElem.childNodes.forEach(child => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = child.tagName.toLowerCase();
      
      if (tag === 'dt') {
        const dtContent = processInlineNodes(child);
        dlResult += `
          <w:p>
            <w:pPr><w:pStyle w:val="DefTerm"/></w:pPr>
            ${dtContent}
          </w:p>
        `;
      } else if (tag === 'dd') {
        const ddContent = processInlineNodes(child);
        dlResult += `
          <w:p>
            <w:pPr><w:pStyle w:val="DefDesc"/></w:pPr>
            ${ddContent}
          </w:p>
        `;
      }
    }
  });
  
  return dlResult;
}



function processBlockNodes(parent) {
  let result = '';
  parent.childNodes.forEach(child => {
    if (child.nodeType === 8) {
      return;
    }

    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent;
      if (text.trim().length > 0) {
        result += `<w:p><w:r>${generateRunProperties({})}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = child.tagName.toLowerCase();

      if (tag === 'p') {
        const content = processInlineNodes(child);
        result += `<w:p>${content}</w:p>`;

      } else if (tag.match(/^h[1-6]$/)) {
        const level = tag.substring(1);
        const style = `Heading${level}`;
        const content = processInlineNodes(child);
        result += `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${content}</w:p>`;

      } else if (tag === 'ul') {
        result += processList(child, 0, false);

      } else if (tag === 'ol') {
        result += processList(child, 0, true);

      } else if (tag === 'blockquote') {
        const content = processInlineNodes(child);
        result += `
          <w:p>
            <w:pPr>
              <w:pStyle w:val="Blockquote"/>
            </w:pPr>
            ${content}
          </w:p>
        `;

      } else if (tag === 'pre') {
        const text = child.textContent || '';
        const lines = text.split('\n');
        result += `
          <w:p>
            <w:pPr>
              <w:pStyle w:val="CodeBlock"/>
            </w:pPr>
            <w:r>
        `;
        lines.forEach((line, i) => {
          if (i > 0) {
            result += `<w:br/>`;
          }
          result += `<w:t xml:space="preserve">${escapeXml(line)}</w:t>`;
        });
        result += `
            </w:r>
          </w:p>
        `;

      } else if (tag === 'hr') {
        result += `
          <w:p>
            <w:pPr>
              <w:pBdr>
                <w:bottom w:val="single" w:sz="4" w:space="1" w:color="auto"/>
              </w:pBdr>
            </w:pPr>
            <w:r>
              <w:t xml:space="preserve"> </w:t>
            </w:r>
          </w:p>
        `;

      } else if (tag === 'br') {
        result += `<w:r><w:br/></w:r>`;

      } else if (tag === 'table') {
        result += processTable(child);

      } else if (tag === 'dl') {
        result += processDefinitionList(child);

      } else if (tag === 'img') {
        const alt = child.getAttribute('alt') || '';
        const src = child.getAttribute('src') || '';
        result += `<w:p><w:r><w:t>[Image: ${escapeXml(alt)} => ${escapeXml(src)}]</w:t></w:r></w:p>`;

      } else if (tag === 'figure') {
        result += '<w:p>';
        result += processBlockNodes(child);
        result += '</w:p>';

      } else if (tag === 'figcaption') {
        const captionContent = processInlineNodes(child);
        result += `<w:p><w:r><w:rPr><w:i/></w:rPr><w:t>${escapeXml(child.textContent)}</w:t></w:r></w:p>`;

      } else if (tag === 'details') {
        result += `<w:p><w:r><w:t>[Details Block Start]</w:t></w:r></w:p>`;
        result += processBlockNodes(child);
        result += `<w:p><w:r><w:t>[End Details Block]</w:t></w:r></w:p>`;

      } else if (tag === 'summary') {
        const summaryContent = processInlineNodes(child);
        result += `<w:p><w:r><w:b/><w:t>${escapeXml(child.textContent)}</w:t></w:r></w:p>`;

      } else {
        result += processBlockNodes(child);
      }
    }
  });
  return result;
}

export function getDocxFileSetFromHtml(htmlContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const bodyContent = processBlockNodes(doc.body);

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyContent}
    <w:sectPr>
      <w:pgSz w:w="11900" w:h="16840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">

  <!-- NORMAL STYLE (Base for most text) -->
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:rPr>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
      <!-- 22 half-points = 11pt font -->
      <w:sz w:val="22"/>
    </w:rPr>
  </w:style>

  <!-- HEADING 1 -->
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:uiPriority w:val="9"/>
    <w:qFormat/>
    <w:pPr>
      <w:outlineLvl w:val="0"/>
      <!-- Centered Heading -->
      <w:jc w:val="center"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <!-- 32 half-points = 16pt font -->
      <w:sz w:val="32"/>
      <w:sz-cs w:val="32"/>
    </w:rPr>
  </w:style>

  <!-- HEADING 2 -->
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:uiPriority w:val="9"/>
    <w:qFormat/>
    <w:pPr>
      <w:outlineLvl w:val="1"/>
      <!-- Left-aligned by default -->
    </w:pPr>
    <w:rPr>
      <w:b/>
      <!-- 28 half-points = 14pt font -->
      <w:sz w:val="28"/>
      <w:sz-cs w:val="28"/>
    </w:rPr>
  </w:style>

  <!-- HEADING 3 -->
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:uiPriority w:val="9"/>
    <w:qFormat/>
    <w:pPr>
      <w:outlineLvl w:val="2"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <!-- 26 half-points = 13pt font -->
      <w:sz w:val="26"/>
      <w:sz-cs w:val="26"/>
    </w:rPr>
  </w:style>

  <!-- HEADING 4 -->
  <w:style w:type="paragraph" w:styleId="Heading4">
    <w:name w:val="heading 4"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:uiPriority w:val="9"/>
    <w:qFormat/>
    <w:pPr>
      <w:outlineLvl w:val="3"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <!-- 24 half-points = 12pt font -->
      <w:sz w:val="24"/>
      <w:sz-cs w:val="24"/>
    </w:rPr>
  </w:style>

  <!-- HEADING 5 -->
  <w:style w:type="paragraph" w:styleId="Heading5">
    <w:name w:val="heading 5"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:uiPriority w:val="9"/>
    <w:qFormat/>
    <w:pPr>
      <w:outlineLvl w:val="4"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <!-- 22 half-points = 11pt font -->
      <w:sz w:val="22"/>
      <w:sz-cs w:val="22"/>
    </w:rPr>
  </w:style>

  <!-- HEADING 6 -->
  <w:style w:type="paragraph" w:styleId="Heading6">
    <w:name w:val="heading 6"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:uiPriority w:val="9"/>
    <w:qFormat/>
    <w:pPr>
      <w:outlineLvl w:val="5"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <!-- 20 half-points = 10pt font -->
      <w:sz w:val="20"/>
      <w:sz-cs w:val="20"/>
    </w:rPr>
  </w:style>

  <!-- BLOCKQUOTE STYLE -->
  <w:style w:type="paragraph" w:styleId="Blockquote">
    <w:name w:val="Blockquote"/>
    <w:basedOn w:val="Normal"/>
    <w:uiPriority w:val="29"/>
    <w:pPr>
      <!-- Indent left 720 = 0.5 inch -->
      <w:ind w:left="720"/>
    </w:pPr>
    <w:rPr>
      <!-- Italicize blockquotes -->
      <w:i/>
    </w:rPr>
  </w:style>

  <!-- CODE BLOCK STYLE -->
  <w:style w:type="paragraph" w:styleId="CodeBlock">
    <w:name w:val="Code Block"/>
    <w:basedOn w:val="Normal"/>
    <w:uiPriority w:val="29"/>
    <w:pPr>
      <!-- Slightly increased line spacing -->
      <w:spacing w:line="240"/>
    </w:pPr>
    <w:rPr>
      <!-- Courier New font -->
      <w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>
    </w:rPr>
  </w:style>

  <!-- TABLE STYLE -->
  <w:style w:type="table" w:styleId="TableNormal">
    <w:name w:val="Normal Table"/>
    <w:uiPriority w:val="99"/>
    <w:tblPr>
      <w:tblBorders>
        <!-- Single line borders around and inside -->
        <w:top w:val="single" w:sz="4" w:color="auto"/>
        <w:left w:val="single" w:sz="4" w:color="auto"/>
        <w:bottom w:val="single" w:sz="4" w:color="auto"/>
        <w:right w:val="single" w:sz="4" w:color="auto"/>
        <w:insideH w:val="single" w:sz="4" w:color="auto"/>
        <w:insideV w:val="single" w:sz="4" w:color="auto"/>
      </w:tblBorders>
    </w:tblPr>
  </w:style>

  <!-- TABLE HEADER CELL STYLE -->
  <w:style w:type="paragraph" w:styleId="TableHeader">
    <w:name w:val="Table Header"/>
    <w:basedOn w:val="Normal"/>
    <w:uiPriority w:val="29"/>
    <w:rPr>
      <w:b/> <!-- Bold for header cells -->
    </w:rPr>
  </w:style>

  <!-- DEFINITION TERM STYLE -->
  <w:style w:type="paragraph" w:styleId="DefTerm">
    <w:name w:val="Definition Term"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>
      <w:b/>
    </w:rPr>
  </w:style>

  <!-- DEFINITION DESCRIPTION STYLE -->
  <w:style w:type="paragraph" w:styleId="DefDesc">
    <w:name w:val="Definition Description"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <!-- Indent a bit to the right -->
      <w:ind w:left="720"/>
    </w:pPr>
  </w:style>

  <!-- HYPERLINK STYLE -->
  <w:style w:type="character" w:styleId="Hyperlink">
    <w:name w:val="Hyperlink"/>
    <w:basedOn w:val="DefaultParagraphFont"/>
    <w:uiPriority w:val="99"/>
    <w:rPr>
      <w:u w:val="single"/>
      <w:color w:val="0000FF"/> <!-- Blue -->
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:ind w:left="360" w:hanging="360"/>
    </w:pPr>
  </w:style>

</w:styles>
`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>

</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" 
                Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" 
                Target="word/document.xml"/>
</Relationships>`;

  const documentXmlRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdStyles" 
                Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"
                Target="styles.xml"/>
  <Relationship Id="rIdNumbering"
                Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering"
                Target="numbering.xml"/>
</Relationships>
`;

const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">

  <!-- BULLETED LISTS: abstractNumId="10" -->
  <w:abstractNum w:abstractNumId="10">
    <w:multiLevelType w:val="hybridMultilevel"/>

    <!-- Level 0 -->
    <w:lvl w:ilvl="0">
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="•"/>
      <w:lvlJc w:val="left"/>
      <w:pPr>
        <w:ind w:left="720" w:hanging="360"/>
      </w:pPr>
    </w:lvl>

    <!-- Level 1 -->
    <w:lvl w:ilvl="1">
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="o"/>
      <w:lvlJc w:val="left"/>
      <w:pPr>
        <w:ind w:left="1440" w:hanging="360"/>
      </w:pPr>
    </w:lvl>

    <!-- Level 2 -->
    <w:lvl w:ilvl="2">
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="■"/>
      <w:lvlJc w:val="left"/>
      <w:pPr>
        <w:ind w:left="2160" w:hanging="360"/>
      </w:pPr>
    </w:lvl>
    
  </w:abstractNum>

  <w:num w:numId="10">
    <w:abstractNumId w:val="10"/>
  </w:num>

  <!-- ORDERED LISTS: abstractNumId="20" -->
  <w:abstractNum w:abstractNumId="20">
    <w:multiLevelType w:val="hybridMultilevel"/>

    <!-- Level 0 -->
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%1."/>
      <w:lvlJc w:val="left"/>
      <w:pPr>
        <w:ind w:left="720" w:hanging="360"/>
      </w:pPr>
    </w:lvl>

    <!-- Level 1 -->
    <w:lvl w:ilvl="1">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%2."/>
      <w:lvlJc w:val="left"/>
      <w:pPr>
        <w:ind w:left="1440" w:hanging="360"/>
      </w:pPr>
    </w:lvl>

    <!-- Level 2 -->
    <w:lvl w:ilvl="2">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%3."/>
      <w:lvlJc w:val="left"/>
      <w:pPr>
        <w:ind w:left="2160" w:hanging="360"/>
      </w:pPr>
    </w:lvl>

  </w:abstractNum>

  <w:num w:numId="20">
    <w:abstractNumId w:val="20"/>
  </w:num>

</w:numbering>
`;
  return [
    { name: "[Content_Types].xml", data: contentTypesXml },
    { name: "_rels/.rels", data: relsXml },
    { name: "word/document.xml", data: documentXml },
    { name: "word/styles.xml", data: stylesXml },
    { name: "word/numbering.xml", data: numberingXml },
    { name: "word/_rels/document.xml.rels", data: documentXmlRels },
  ];

}
