import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { Draft } from "../sources/types"
import { cleanPlace, nameMatch, nameVariants, pickCandidate, sameName, samePlace, type Candidate } from "./geocode"

describe("sameName", () => {
  it("matches an institution under its own name, in any language's spelling", () => {
    assert.ok(sameName("University of California, Los Angeles", "University of California, Los Angeles"))
    assert.ok(sameName("Hong Kong Polytechnic University", "The Hong Kong Polytechnic University"))
    assert.ok(sameName("University of Mannheim", "Universität Mannheim"))
    assert.ok(sameName("Northeastern University", "Northeastern University - Arlington"))
    assert.ok(sameName("Johns Hopkins University", "Johns Hopkins University - Homewood Campus"))
    assert.ok(sameName("Indiana University", "Indiana University Bloomington", "Bloomington Indiana United States"))
    assert.ok(sameName("Harvard Kennedy School", "Harvard Kennedy School Library"))
    assert.ok(sameName("London School of Economics", "London School of Economics and Political Science"))
    assert.ok(sameName("Nanyang Technological University Singapore", "Nanyang Technological University"))
    assert.ok(sameName("UCLA", "University of California, Los Angeles"))
    assert.ok(sameName("UNSW Sydney", "University of New South Wales", "Sydney New South Wales Australia"))
    assert.ok(sameName("University of Hawaii at Manoa", "University of Hawaiʻi at Mānoa"))
    assert.ok(sameName("Centre College", "Centre College"))
    assert.ok(sameName("Uber", "Uber HQ"))
  })

  it("ranks the closer of two matches higher", () => {
    assert.ok(nameMatch("University of Chicago", "University of Chicago") > nameMatch("University of Chicago", "Loyola University of Chicago"))
  })

  it("rejects names that share only generic words, or too little", () => {
    assert.ok(!sameName("Columbia Business School", "Darla Moore School of Business"))
    assert.ok(!sameName("BRG", "Bridge"))
    assert.ok(!sameName("Cornerstone Research", "Cornerstone Church"))
    assert.ok(!sameName("Stanford Institute for Economic Policy Research", "Stanford University"))
    assert.ok(!sameName("Centre College", "Centre College of Kentucky Arts Center"))
    assert.ok(!sameName("Keystone", "Keystone Building"))
    assert.ok(!sameName("ETS", "Wonder Plaza (ETS)"))
    assert.ok(!sameName("City University of New York", "New York University", "New York New York United States"))
    assert.ok(!sameName("New York University", "City University of New York", "New York New York United States"))
    assert.ok(!sameName("University of Osaka", "Osaka University of Arts", "Toyonaka Osaka Japan"))
    assert.ok(!sameName("Joint Commission", "Delaware River Joint Toll Bridge Commission"))
    assert.ok(!sameName("Cornerstone Research", "Cornerstone Research & Marketing"))
    // Far from the listing's city, a campus-qualified name may be another campus of the same system
    assert.ok(!sameName("University of Minnesota", "University of Minnesota - Rochester", "", false))
  })
})

describe("pickCandidate", () => {
  const at = (name: string, kind: string): Candidate => ({ name, kind, lat: 0, lng: 0 })

  it("keeps only the kinds of places that hire", () => {
    assert.equal(pickCandidate("BRG", [at("Bridge", "highway/footway")]), null)
    assert.equal(pickCandidate("Amazon", [at("Amazon Fulfillment Center AFW1", "building/warehouse")]), null)
    assert.equal(pickCandidate("J. P. Morgan", [at("J. P. Morgan's Fountain", "amenity/fountain")]), null)
  })

  it("takes a feature named exactly after a university on its campus when that's all there is", () => {
    const stop = at("Hong Kong University of Science and Technology", "highway/bus_stop")
    assert.equal(pickCandidate("Hong Kong University of Science and Technology", [stop]), stop)
    const campus = at("Hong Kong University of Science and Technology", "amenity/university")
    assert.equal(pickCandidate("Hong Kong University of Science and Technology", [stop, campus]), campus)
  })

  it("prefers the closest name, then the nearer campus", () => {
    const loyola = at("Loyola University of Chicago", "amenity/university")
    const uchicago = at("University of Chicago", "amenity/university")
    assert.equal(pickCandidate("University of Chicago", [loyola, uchicago]), uchicago)
    const calabasas = { ...at("Pepperdine University - Calabasas Campus", "amenity/university"), lat: 34.139, lng: -118.707 }
    const malibu = { ...at("Pepperdine University - Malibu Campus", "amenity/university"), lat: 34.043, lng: -118.709 }
    assert.equal(pickCandidate("Pepperdine University", [calabasas, malibu], "Malibu", { lat: 34.036, lng: -118.689 }), malibu)
  })
})

describe("nameVariants", () => {
  it("drops acronyms and legal suffixes, and splits compound names", () => {
    assert.deepEqual(nameVariants("University of California, Los Angeles (UCLA)"), ["University of California, Los Angeles", "UCLA"])
    assert.deepEqual(nameVariants("PricewaterhouseCoopers LLP (PwC)"), ["PricewaterhouseCoopers", "PwC"])
    assert.deepEqual(nameVariants("Sapienza Università di Roma - Dipartimento Memotef").slice(0, 2), [
      "Sapienza Università di Roma - Dipartimento Memotef",
      "Sapienza Università di Roma",
    ])
    assert.ok(nameVariants("Warwick Business School, The University of Warwick").includes("University of Warwick"))
    assert.ok(nameVariants("Mansueto Institute for Urban Innovation at the University of Chicago").includes("University of Chicago"))
    assert.ok(nameVariants("Renmin University of China-Department of Public Finance").includes("Renmin University of China"))
    assert.deepEqual(nameVariants("Centre College"), ["Centre College"])
  })

  it("finds the university a school belongs to", () => {
    assert.ok(nameVariants("University of Chicago Booth School of Business").includes("University of Chicago"))
    assert.ok(nameVariants("Columbia University School of International and Public Affairs").includes("Columbia University"))
    assert.ok(nameVariants("New York University Arts and Science").includes("New York University"))
    assert.ok(nameVariants("Hong Kong University of Science and Technology, Hong Kong Campus").includes("Hong Kong University of Science and Technology"))
  })
})

describe("samePlace", () => {
  it("matches a place under its own name only", () => {
    assert.ok(samePlace("Saint Augustine", "St. Augustine"))
    assert.ok(samePlace("Al-Rayyan", "Al Rayyan"))
    assert.ok(samePlace("New York", "City of New York"))
    assert.ok(samePlace("Yushima, Bunkyo", "Yushima"))
    assert.ok(!samePlace("New Orleans", "New Orleans Square"))
    assert.ok(samePlace("Newcastle", "Newcastle upon Tyne", true))
    assert.ok(!samePlace("Beijing", "Beijing Economic and Technological Development Area", false))
  })
})

describe("cleanPlace", () => {
  const place = (city: string | null, admin: string | null, countryCode: string) => {
    const d = { city, admin, countryCode } as Draft
    cleanPlace(d)
    return [d.city, d.admin]
  }

  it("drops placeholders and regions that are countries", () => {
    assert.deepEqual(place("Cairo", "Other / Non-US", "EG"), ["Cairo", null])
    assert.deepEqual(place("Hanoi", "Remote/Other Non-US", "VN"), ["Hanoi", null])
    assert.deepEqual(place(null, "Seoul", "KR"), ["Seoul", null])
    assert.deepEqual(place(null, "Pennsylvania", "US"), [null, "Pennsylvania"])
    assert.deepEqual(place("Fully remote", null, "US"), [null, null])
    assert.deepEqual(place("Rome", "ITALY", "IT"), ["Rome", null])
    assert.deepEqual(place("Hong Kong", "Hong Kong", "HK"), ["Hong Kong", null])
    assert.deepEqual(place("Atlanta", "Georgia", "US"), ["Atlanta", "Georgia"])
  })

  it("splits places that carry a region or an institution", () => {
    assert.deepEqual(place("Washington, DC", "District of Columbia", "US"), ["Washington", "District of Columbia"])
    assert.deepEqual(place("Vanderbilt University, Nashville", "Tennessee", "US"), ["Nashville", "Tennessee"])
    assert.deepEqual(place("Atlanta Area", "GA", "US"), ["Atlanta", "GA"])
    assert.deepEqual(place("Waterville, ME 04901", "Maine", "US"), ["Waterville", "Maine"])
    assert.deepEqual(place("90478 Nürnberg", null, "DE"), ["Nürnberg", null])
    assert.deepEqual(place("Metropolitan Community College of Kansas City", "MO", "US"), ["Kansas City", "MO"])
  })
})
