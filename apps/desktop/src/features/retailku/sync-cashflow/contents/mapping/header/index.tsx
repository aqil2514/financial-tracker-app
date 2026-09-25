import { Description } from "./description";
import { Filter } from "./filter";

export function Header() {
  return (
    
    <div className="space-y-4">
      <Description />
      <Filter />
    </div>
  );
}
