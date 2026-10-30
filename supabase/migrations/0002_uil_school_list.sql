-- The UIL alignment lists schools by name only, so mascot and city are filled in later.
-- UIL names are unique statewide, so they identify a school until TEA campus ids are added.
alter table schools alter column mascot drop not null;
alter table schools alter column city drop not null;
alter table schools add constraint schools_name_key unique (name);
