import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { resolveDeadline } from "./deadline"

const REF = "2026-10-01"
const resolve = (text: string, listed: string | null = null, opts: { ref?: string; usOrder?: boolean } = {}) =>
  resolveDeadline({ text, listed, ref: opts.ref ?? REF, usOrder: opts.usOrder ?? true })

// Sentences below are from real postings on JOE, EJM, jobs.ac.uk, THE, AJO, APPAM and AcademicTransfer
describe("resolveDeadline", () => {
  it("keeps a plain deadline", () => {
    assert.deepEqual(resolve("The deadline for applications is November 1, 2026.", "2026-11-01"), {
      deadline: "2026-11-01",
      deadlineKind: "deadline",
      closesAt: null,
      rolling: false,
    })
  })

  it("finds a deadline the board leaves out", () => {
    const r = resolve("The initial deadline is November 1, 2026.")
    assert.equal(r.deadline, "2026-11-01")
  })

  it("prefers an earlier full-consideration date and keeps the board's date as the close", () => {
    const r = resolve(
      "To receive full consideration, applications should be received online by November 1, 2026, but the search will remain open until filled.",
      "2027-01-31",
    )
    assert.deepEqual(r, { deadline: "2026-11-01", deadlineKind: "priority", closesAt: "2027-01-31", rolling: true })
  })

  it("reads a review start as the date to apply by", () => {
    const r = resolve(
      "Our review of completed applications will begin on November 13, 2026 and continue until the position is filled.",
      "2027-03-01",
    )
    assert.deepEqual(r, { deadline: "2026-11-13", deadlineKind: "review", closesAt: "2027-03-01", rolling: true })
    assert.equal(resolve("Next review date: Wednesday, Nov 18, 2026 at 11:59pm (Pacific Time)").deadlineKind, "review")
    assert.equal(
      resolve("Complete applications including cover letter, CV, job market papers, and three letters of recommendation will be reviewed starting November 15, 2026.", "2026-12-01").deadline,
      "2026-11-15",
    )
    assert.equal(resolve("The search committee will begin considering applications November 8, 2026.").deadline, "2026-11-08")
  })

  it("separates a priority date from the final close", () => {
    const r = resolve(
      "Applications will be reviewed on a rolling basis, with a priority deadline of November 15, 2026; applications close November 30, 2026.",
    )
    assert.deepEqual(r, { deadline: "2026-11-15", deadlineKind: "priority", closesAt: "2026-11-30", rolling: true })
  })

  it("takes a date without a year in the posting's own season", () => {
    assert.equal(resolve("The application deadline is November 15th.", "2026-11-16").deadline, "2026-11-15")
    assert.equal(resolve("Applications are due January 15.", null, { ref: "2026-11-20" }).deadline, "2027-01-15")
  })

  it("treats a board date a day off the text's as the same date", () => {
    const r = resolve("Our application deadline for 2027 entry is 31 January 2027.", "2027-01-30", { usOrder: false })
    assert.deepEqual(r, { deadline: "2027-01-31", deadlineKind: "deadline", closesAt: null, rolling: false })
  })

  it("follows an extension", () => {
    const r = resolve("On Sept 30, 2026, the recruiter extended the deadline to Feb 1, 2027", "2027-02-01")
    assert.equal(r.deadline, "2027-02-01")
  })

  it("ignores start dates, interviews, letters and funding periods", () => {
    assert.equal(resolve("The position is full-time, with an anticipated start date no later than October 1, 2027.").deadline, null)
    assert.equal(resolve("Deadline for recommendation letters: February 7, 2027.").deadline, null)
    assert.equal(resolve("This post is full-time and has funding available until 31 March 2028.").deadline, null)
    assert.equal(
      resolve("Closing date: 25 October 2026, interview date: 4 November 2026.", null, { usOrder: false }).deadline,
      "2026-10-25",
    )
    assert.equal(
      resolve("A.B.D.s will also be considered, but the degree must be conferred by the start date (August 1, 2027).").deadline,
      null,
    )
    assert.equal(
      resolve("All application materials, including recent letters, must be received by November 16, 2026.").deadline,
      "2026-11-16",
    )
  })

  it("ignores an opening date before a closing date", () => {
    const r = resolve(
      "The admissions portal opening date is 20th October 2026, and the closing date for applications is 1st December 2026 at 11:59pm.",
      null,
      { usOrder: false },
    )
    assert.equal(r.deadline, "2026-12-01")
  })

  it("uses a whichever-is-earlier close", () => {
    const r = resolve(
      "Review of applications will start as soon as possible and continue until November 30, 2026, or until the posts are filled, whichever is earlier.",
      "2026-11-30",
    )
    assert.deepEqual(r, { deadline: "2026-11-30", deadlineKind: "deadline", closesAt: null, rolling: true })
  })

  it("drops a board date later than the text's own close", () => {
    const r = resolve("Applications close:Jun 30, 2027 (HK Time)", "2027-07-30", { ref: "2026-07-01" })
    assert.deepEqual(r, { deadline: "2027-06-30", deadlineKind: "deadline", closesAt: null, rolling: false })
  })

  it("sets conditional dates aside when there is a main one", () => {
    const r = resolve(
      "Priority will be given to applications that are submitted before November 1, 2026. For applicants that will be attending the INFORMS Annual Conference in San Francisco, it is highly recommended that they submit their initial materials (CV and statements) by October 19, 2026.",
      "2026-11-01",
    )
    assert.equal(r.deadline, "2026-11-01")
    assert.equal(r.deadlineKind, "priority")
  })

  it("keeps a funding deadline before a self-funded one", () => {
    const r = resolve(
      "To be considered for funding, you should submit your application no later than the 30th of November 2026. Self-funded candidates can apply until the 30th of June 2027.",
      "2026-11-30",
      { usOrder: false },
    )
    assert.deepEqual(r, { deadline: "2026-11-30", deadlineKind: "deadline", closesAt: "2027-06-30", rolling: false })
  })

  it("reads labels on their own line", () => {
    assert.equal(resolve("Closing date:\n9 November 2026 @23:45", null, { usOrder: false }).deadline, "2026-11-09")
    assert.equal(resolve("Application deadline: 11/15/2026").deadline, "2026-11-15")
    assert.equal(resolve("Deadline for receipt of applications: 2026 November 01").deadline, "2026-11-01")
  })

  it("reads day-first numeric dates outside North America", () => {
    assert.equal(resolve("The closing date for application is the 31/12/2026.", null, { usOrder: false }).deadline, "2026-12-31")
    assert.equal(resolve("Bewerbungsschluss ist der 15.11.2026.", null, { usOrder: false }).deadline, "2026-11-15")
  })

  it("does not read the verb may as a month", () => {
    assert.equal(resolve("Applications received after November 3 may be considered if the position is open.").deadline, null)
  })

  it("marks rolling postings without a date", () => {
    assert.deepEqual(resolve("Applications will be accepted until the position is filled."), {
      deadline: null,
      deadlineKind: null,
      closesAt: null,
      rolling: true,
    })
    assert.equal(resolve("The position will remain open until November 30, 2026.").rolling, false)
  })
})

describe("resolveDeadline, ambiguous and long phrasings", () => {
  it("reads an ambiguous numeric date the way the board's date does", () => {
    assert.equal(resolve("Application deadline: 11/08/2026", "2026-11-08", { usOrder: false }).deadline, "2026-11-08")
    assert.equal(resolve("Application deadline: 11/08/2026", null, { usOrder: false }).deadline, "2026-08-11")
  })

  it("keeps a date after a list of materials that names letters", () => {
    const r = resolve(
      "To apply, send a motivation letter, a CV with detailed research and teaching record, job market paper and two reference letters through the EconJobMarket portal by March 30, 2027, and preferably by December 1, 2026 in order to be considered in the first round of applications.",
      "2027-03-30",
      { usOrder: false },
    )
    assert.deepEqual(r, { deadline: "2026-12-01", deadlineKind: "priority", closesAt: "2027-03-30", rolling: false })
    assert.equal(resolve("Please submit a CV, job market paper, and three letters of recommendation by November 15, 2026.").deadline, "2026-11-15")
    assert.equal(resolve("Reference letters should be uploaded by November 30, 2026.").deadline, null)
  })

  it("reads recommendations and encouragements as priority dates", () => {
    const r = resolve(
      "We recommend that candidates submit their applications by November 20th, 2026, as we will conduct virtual interviews as early as December 1st.",
      "2027-04-30",
    )
    assert.deepEqual(r, { deadline: "2026-11-20", deadlineKind: "priority", closesAt: "2027-04-30", rolling: false })
    assert.equal(resolve("To be considered on our main timeline, apply by October 31, 2026.").deadlineKind, "priority")
  })

  it("prefers a full-consideration date to an earlier review start, and a review start to a later deadline", () => {
    const miami = resolve(
      "To receive full consideration, complete applications should be received by November 20, 2026. Screening of applications will begin November 9, 2026, and continue until the position is filled.",
    )
    assert.equal(miami.deadline, "2026-11-20")
    const houston = resolve(
      "Review of candidates will begin November 1st, 2026, and will continue until the position is filled.\nApplication deadline: 04/30/2027",
      "2027-04-30",
    )
    assert.deepEqual(houston, { deadline: "2026-11-01", deadlineKind: "review", closesAt: "2027-04-30", rolling: true })
  })

  it("reads permission and negated review as what they are", () => {
    const r = resolve(
      "Applications may be submitted before October 1; however, they will not be reviewed before October 1, 2026.",
      "2026-11-15",
    )
    assert.deepEqual(r, { deadline: "2026-10-01", deadlineKind: "review", closesAt: "2026-11-15", rolling: false })
  })

  it("reads a review that begins by a date as a review start", () => {
    assert.equal(
      resolve("Review of applications will begin by November 1, 2026 and continue until the positions are closed.", "2026-12-01").deadlineKind,
      "review",
    )
  })
})

describe("resolveDeadline, links and eligibility", () => {
  it("reads a deadline after a link", () => {
    const r = resolve(
      "Applicants must submit two separate applications: one to the President’s Postdoctoral Fellowship Program (PPFP) site (http://presidentspostdoc.umich.edu/ppfp-application.php) by November 1, 2026 (note: this application will open September 1, 2026) and a second directly to the Ford School of Public Policy at https://apply.interfolio.com/189148 by September 13, 2026.",
      "2026-09-13",
      { ref: "2026-08-20" },
    )
    assert.deepEqual(r, { deadline: "2026-09-13", deadlineKind: "deadline", closesAt: "2026-11-01", rolling: false })
  })

  it("ignores an eligibility cutoff", () => {
    const r = resolve(
      "Applications are invited from candidates who have completed less than five years' full-time research, or part-time equivalent, by 1 October 2026. All applications are to be submitted online by Monday 9 November 2026.",
      "2026-11-09",
      { usOrder: false },
    )
    assert.deepEqual(r, { deadline: "2026-11-09", deadlineKind: "deadline", closesAt: null, rolling: false })
  })
})
