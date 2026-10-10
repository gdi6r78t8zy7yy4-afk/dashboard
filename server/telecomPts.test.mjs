import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { parsePtsCoverageWorkbook } from './telecomPts.mjs'

function makeCoverageWorkbook() {
  const sharedStrings = [
    'Kommun/Län/Riket',
    'Kod',
    'Alla operatörer - minst 10 Mbit/s - 8 db',
    'Alla operatörer - minst 100 Mbit/s - 8 db',
    'Alla operatörer - 5G - 8 db',
    'Norrbottens län',
    'Blekinge län',
    '10',
    '25',
    '>99,99%',
  ]
  const sharedXml = `<sst>${sharedStrings.map((value) => `<si><t>${value}</t></si>`).join('')}</sst>`
  const workbookXml = '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Yttäckning 2025" sheetId="1" r:id="rId1"/></sheets></workbook>'
  const relsXml = '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'
  const sheetXml = '<worksheet><sheetData><row r="2"><c r="A2" t="s"><v>0</v></c><c r="B2" t="s"><v>1</v></c><c r="D2" t="s"><v>2</v></c><c r="M2" t="s"><v>3</v></c><c r="P2" t="s"><v>4</v></c></row><row r="3"><c r="A3" t="s"><v>5</v></c><c r="B3" t="s"><v>7</v></c><c r="D3"><v>0.8</v></c><c r="M3"><v>0.4</v></c><c r="P3"><v>0.9</v></c></row><row r="4"><c r="A4" t="s"><v>6</v></c><c r="B4" t="s"><v>8</v></c><c r="D4" t="s"><v>9</v></c><c r="M4"><v>0.5</v></c><c r="P4"><v>0.7</v></c></row></sheetData></worksheet>'
  return zipSync({
    'xl/workbook.xml': strToU8(workbookXml),
    'xl/_rels/workbook.xml.rels': strToU8(relsXml),
    'xl/sharedStrings.xml': strToU8(sharedXml),
    'xl/worksheets/sheet1.xml': strToU8(sheetXml),
  })
}

describe('PTS coverage workbook adapter', () => {
  it('extracts county metrics from the official workbook columns and normalizes percentages', () => {
    expect(parsePtsCoverageWorkbook(makeCoverageWorkbook())).toEqual([
      {
        code: '10',
        name: 'Norrbottens län',
        mobile10Mbps8Db: { value: 80, qualifier: 'exact' },
        mobile100Mbps8Db: { value: 40, qualifier: 'exact' },
        mobile5g8Db: { value: 90, qualifier: 'exact' },
      },
      {
        code: '25',
        name: 'Blekinge län',
        mobile10Mbps8Db: { value: 99.99, qualifier: 'greater-than' },
        mobile100Mbps8Db: { value: 50, qualifier: 'exact' },
        mobile5g8Db: { value: 70, qualifier: 'exact' },
      },
    ])
  })
})