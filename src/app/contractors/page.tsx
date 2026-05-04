import ContractorSearchClient from './ContractorSearchClient';

export const metadata = {
  title: 'Contractor License Search | DwellHand',
  description: 'Search all permits tied to a contractor license number in California.',
};

export default function ContractorPage() {
  return <ContractorSearchClient />;
}
