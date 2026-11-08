import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { detailFacts, murAdapter } from "./mur"

/** A list entry as the portal renders it: deadline, host, linked title, then a code line per post */
const entry = (href: string, host: string, title: string, codes: string[] = []) => `
  <p>
    <em class="aperto">scade il 30/11/2026 - alle ore 12:00</em><br />
    <strong>${host}</strong><br />
    Titolo: <a href="${href}">${title}</a><br />
    ${codes.map((c) => `<strong>${c}</strong><br />`).join("\n    ")}
    Numero posti: ${codes.length || 1}
  </p>`
/** A detail page's facts table */
const page = (rows: Array<[string, string]>) => `<table>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</table>`

const BOCCONI = "/profcalls.php/public/job/id_job/152784"
const PALERMO = "/profcalls.php/public/job/id_job/153727"
const PADOVA = "/profcalls.php/public/job/id_job/153001"
const BERGAMO_PHD = "/doctorate.php/public/fellowship/id_fellow/319659"
const POLITO_PHD = "/doctorate.php/public/fellowship/id_fellow/319081"
const BOCCONI_PHD = "/doctorate.php/public/fellowship/id_fellow/319462"

const raw = JSON.stringify({
  fetchedAt: "2026-11-08T12:00:00Z",
  lists: {
    profcalls: [
      // No code in the list line or title: the detail page names it
      entry(BOCCONI, "Univ. Bocconi MILANO", "Posizione da Professore Associato presso il Dipartimento di Economia (Professore di seconda fascia )"),
      // Four posts; ours is the second listed
      entry(PALERMO, "Univ. PALERMO", "4 posti di professore di I fascia ex art. 18 comma 4ter L. 240/2010 (Professore di prima fascia )", [
        "Settore Microbiologia BIOS-15/A",
        "Settore Economia politica ECON-01/A",
        "Settore Chimica fisica CHEM-02/A",
      ]),
      // Codes listed, none ours: dropped whatever its detail page says
      entry(PADOVA, "Univ. PADOVA", "Professore di seconda fascia (Professore di seconda fascia )", ["Settore Genetica BIOS-14/A"]),
    ].join(""),
    doctorate: [
      entry(BERGAMO_PHD, "Univ. BERGAMO", "Terzo bando di concorso per l'ammissione ai corsi di dottorato di ricerca - XLII Ciclo"),
      entry(POLITO_PHD, "Politecnico di TORINO", "Bando di concorso per l'ammissione ai corsi di dottorato di ricerca (42° ciclo)"),
      entry(BOCCONI_PHD, "Univ. Bocconi MILANO", "Bando di concorso per l'ammissione ai dottorati di ricerca 43° ciclo"),
    ].join(""),
  },
  details: {
    [BOCCONI]: detailFacts(
      page([
        ["Titolo del progetto di ricerca in inglese", "Associate Professor with Tenure Department of Economics"],
        ["G.S.D.", "13/ECON-01 - ECONOMIA POLITICA"],
        ["S.S.D", "-"],
        ["Organizzazione/Ente", "Bocconi University"],
        ["Città", "Milano"],
      ]),
    ),
    [PADOVA]: detailFacts(page([["G.S.D.", "13/ECON-01 - ECONOMIA POLITICA"]])),
    [BERGAMO_PHD]: detailFacts(
      page([
        ["Settore Concorsuale", "01 - Scienze matematiche e informatiche"],
        ["S.S.D", "-"],
        ["Settore Concorsuale", "13 - Scienze economiche e statistiche"],
        ["Settore Concorsuale", "09 - Ingegneria industriale e dell'informazione"],
        ["Settore Concorsuale", "14 - Scienze politiche e sociali"],
        ["Nome dell'Ente finanziatore", "Università degli studi di Bergamo"],
        ["Città", "Bergamo - Dalmine"],
      ]),
    ),
    // A whole university's PhD round: open to every area, so to none of ours in particular
    [POLITO_PHD]: detailFacts(
      page(
        ["01", "02", "03", "04", "05", "06", "07", "08", "09", "11", "12", "13", "14"].map((a): [string, string] => [
          "Settore Concorsuale",
          `${a} - Area ${a}`,
        ]),
      ),
    ),
    [BOCCONI_PHD]: detailFacts(
      page([
        ["G.S.D.", "01/MATH-03 - ANALISI MATEMATICA"],
        ["G.S.D.", "13/ECON-02 - POLITICA ECONOMICA"],
        ["G.S.D.", "13/ECON-03 - SCIENZA DELLE FINANZE"],
        ["G.S.D.", "14/GSPS-02 - SCIENZA POLITICA"],
      ]),
    ),
  },
})
const drafts = new Map(murAdapter.parse(raw).map((d) => [d.url.replace("https://bandi.mur.gov.it", ""), d]))

describe("MUR calls", () => {
  it("finds our post among the several a call lists", () => {
    const d = drafts.get(PALERMO)
    assert.ok(d)
    assert.equal(d.title, "Full professor in Economics")
    assert.match(d.detail.blocks.at(-1)!.text, /^Disciplinary codes: .*ECON-01\/A/)
  })

  it("reads the code from the detail page when the list gives none", () => {
    const d = drafts.get(BOCCONI)
    assert.ok(d)
    assert.equal(d.title, "Associate professor in Economics: Associate Professor with Tenure Department of Economics")
    assert.equal(d.institution, "Bocconi University")
    assert.deepEqual(d.disciplines, ["econ"])
  })

  it("lets the list line decide when it names codes", () => {
    assert.equal(drafts.has(PADOVA), false)
  })

  it("lists PhD rounds open to our areas or groups, with each discipline, and not a whole university's", () => {
    const bergamo = drafts.get(BERGAMO_PHD)
    assert.ok(bergamo)
    assert.equal(bergamo.id, "mur-doctorate-319659")
    assert.equal(bergamo.category, "predoc")
    assert.equal(bergamo.title, "PhD position in Economics and political science")
    assert.deepEqual(bergamo.disciplines, ["econ", "polsci"])
    assert.equal(bergamo.city, "Bergamo", "the first of its two campuses")

    const bocconi = drafts.get(BOCCONI_PHD)
    assert.ok(bocconi)
    assert.equal(bocconi.title, "PhD position in Economics and political science")
    assert.ok(bocconi.fields.includes("H"), "public finance carries its field")

    assert.equal(drafts.has(POLITO_PHD), false)
  })
})

describe("detailFacts", () => {
  it("keeps every code row and the call's facts, not placeholders", () => {
    const facts = detailFacts(
      page([
        ["G.S.D.", "13/ECON-09 - ECONOMIA DEGLI INTERMEDIARI FINANZIARI"],
        ["S.S.D", "ECON-09/B - Economia degli intermediari finanziari"],
        ["S.S.D", "-"],
        ["S.S.D", "PSIC-03/A - Psicologia sociale"],
        ["Città", "Bergamo"],
        ["Città", "Dalmine"],
        ["E-mail", "someone@example.org"],
      ]),
    )
    assert.deepEqual(facts, {
      codes:
        "13/ECON-09 - ECONOMIA DEGLI INTERMEDIARI FINANZIARI; ECON-09/B - Economia degli intermediari finanziari; PSIC-03/A - Psicologia sociale",
      Città: "Bergamo",
    })
  })
})
