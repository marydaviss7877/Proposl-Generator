import { queryGraphQL } from './client'
import { getValidAccessToken } from './tokens'

export interface UpworkJobPosting {
  id: string
  title: string
  description: string
  skills: string[]
  budget: string
  postedAt: string
  url: string
}

// ⚠️ UNVERIFIED SCHEMA — Upwork's GraphQL docs site returns 403 to automated
// fetches, and API access for this project isn't confirmed-approved yet, so
// this query is assembled from UPWORK_API_ONBOARDING_GUIDE.md + public docs,
// not a live schema check. The first time real credentials exist, verify
// every field below against Upwork's GraphQL Explorer/introspection before
// relying on this in production — `marketPlaceJobFilter`'s sub-fields and the
// exact job node fields are the most likely to need adjustment.
const SEARCH_QUERY = `
  query MarketplaceJobPostingsSearch($filter: MarketplaceJobFilter, $searchType: MarketplaceJobPostingSearchType) {
    marketplaceJobPostingsSearch(marketPlaceJobFilter: $filter, searchType: $searchType) {
      totalCount
      edges {
        node {
          id
          ciphertext
          title
          description
          skills { name }
          amount { rawValue currency }
          createdDateTime
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`

interface SearchResponseShape {
  marketplaceJobPostingsSearch: {
    totalCount: number
    edges: Array<{
      node: {
        id: string
        ciphertext?: string
        title: string
        description: string
        skills?: Array<{ name: string }>
        amount?: { rawValue: string; currency: string } | null
        createdDateTime: string
      }
    }>
  }
}

export async function searchJobPostings(keywords: string): Promise<UpworkJobPosting[]> {
  const accessToken = await getValidAccessToken()
  const data = await queryGraphQL<SearchResponseShape>(accessToken, SEARCH_QUERY, {
    filter: { titleExpression_eq: keywords },
    searchType: 'USER_JOBS_SEARCH',
  })

  return data.marketplaceJobPostingsSearch.edges.map(({ node }) => ({
    id: node.id,
    title: node.title,
    description: node.description,
    skills: (node.skills ?? []).map(s => s.name),
    budget: node.amount ? `${node.amount.rawValue} ${node.amount.currency}` : '',
    postedAt: node.createdDateTime,
    url: node.ciphertext ? `https://www.upwork.com/jobs/${node.ciphertext}` : '',
  }))
}
