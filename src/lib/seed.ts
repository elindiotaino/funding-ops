import { db } from "@/db";
import { fundingPrograms, fundingTasks } from "@/db/schema";

export function seedCoreData() {
  const hasFundingPrograms = db.select().from(fundingPrograms).limit(1).get();
  if (!hasFundingPrograms) {
    db.insert(fundingPrograms)
      .values([
        {
          name: "DDEC Capital Semilla",
          sponsor: "DDEC Puerto Rico",
          maxFunding: "Varies",
          eligibility: "PyMEs under threshold requirements",
          deadline: "Ongoing",
          status: "researching",
          sourceUrl:
            "https://www.desarrollo.pr.gov/incentivo-de-capital-semilla-para-pymes-de-nuevas",
          notes: "Baseline seed copied from client-acquisition-hub.",
        },
        {
          name: "Vocational Rehabilitation",
          sponsor: "Puerto Rico Government",
          maxFunding: "TBD",
          eligibility: "Entrepreneur-specific assistance",
          deadline: "Ongoing",
          status: "researching",
        },
        {
          name: "SBA Assistance Programs",
          sponsor: "Small Business Administration",
          maxFunding: "Varies",
          eligibility: "Small business",
          deadline: "Varies",
          status: "researching",
        },
      ])
      .run();
  }

  const hasFundingTasks = db.select().from(fundingTasks).limit(1).get();
  if (!hasFundingTasks) {
    db.insert(fundingTasks)
      .values([
        {
          title: "Collect tax records",
          status: "pending",
          notes: "Carry over from the original funding workflow.",
        },
        {
          title: "Review verified government sources",
          status: "pending",
          notes: "Replace placeholder discovery notes with official findings.",
        },
      ])
      .run();
  }
}
